"""Kanıt (§27 POST /v1/evidence/uploads; §25 dosya güvenliği).

Akış: 1) yükleme oturumu (sha256 + ad + boyut; yinelenen adayı T07) → 2) içerik `PUT .../content` (boyut/tür sınırı,
karma doğrulaması, tarama kancası) → 3) `scan_status=clean` olunca kısa ömürlü imzalı indirme bağlantısı.
Nesne deposu ayarlı değilse 1. adım `upload: null` döner ve 2–3 503 OBJECT_STORE_UNAVAILABLE verir (sahte tamamlama yok, kural 10).
"""

from __future__ import annotations

import hashlib
import os
import uuid

from fastapi import APIRouter, Query, Request
from fastapi.responses import FileResponse

from .. import idempotency, serializers, workflow
from ..audit import record_event
from ..deps import Ctx, Repo
from ..envelope import ok
from ..errors import ApiError, not_found
from ..objectstore import TooLarge
from ..repo import Evidence
from ..schemas import EvidenceUploadRequest
from ..security import BLOCKED_EXTENSIONS

router = APIRouter(prefix="/v1/evidence", tags=["evidence"])


def _store(request: Request):
    store = request.app.state.object_store
    if store is None:
        raise ApiError(503, "OBJECT_STORE_UNAVAILABLE", "Nesne deposu yapılandırılmadı (KOZA_OBJECT_STORE_DIR).", retryable=True)
    return store


def _upload_descriptor(request: Request, evidence_id: str) -> dict | None:
    if request.app.state.object_store is None:
        return None
    pol = request.app.state.security
    return {"method": "PUT", "path": f"/v1/evidence/uploads/{evidence_id}/content", "max_bytes": pol.evidence_max_bytes,
            "allowed_content_types": sorted(pol.evidence_allowed_types), "note_tr": "Gövde ham dosya; Content-Type zorunlu."}


@router.post("/uploads", status_code=201, summary="Kanıt yükleme oturumu (sha256 + ad + boyut)")
def create_upload(body: EvidenceUploadRequest, request: Request, repo: Repo, ctx: Ctx):
    """Kurum içinde aynı karma varsa `duplicate_candidates` listelenir (T07). Nesne deposu varsa `upload` içerik
    yükleme adresini verir; yoksa null. `scan_status` içerik yüklenip taranana kadar `pending`."""
    workflow.require_roles(ctx, workflow.EVIDENCE_ROLES)
    if body.record_id is not None and repo.get_record(ctx.tenant_id, body.record_id) is None:
        raise not_found("Kayıt")
    ext = os.path.splitext(body.filename)[1].lower()
    if ext in BLOCKED_EXTENSIONS:
        raise ApiError(422, "EVIDENCE_TYPE_BLOCKED", "Bu dosya türü kabul edilmez (makro/aktif içerik politikası, §25).",
                       field_errors=[{"field": "filename", "message": f"{ext} uzantısı engelli."}])
    if body.size_bytes > request.app.state.security.evidence_max_bytes:
        raise ApiError(413, "EVIDENCE_TOO_LARGE", "Dosya boyut sınırını aşıyor.",
                       details={"max_bytes": request.app.state.security.evidence_max_bytes})
    key = idempotency.get_key(request, required=False)
    payload = body.model_dump(mode="json")
    request_hash, previous = idempotency.lookup(repo, ctx, "POST /v1/evidence/uploads", key, payload)
    if previous is not None:
        return ok(request, previous.response, status_code=previous.status_code, meta={"idempotent_replay": True})

    duplicates = repo.find_evidence_by_hash(ctx.tenant_id, body.sha256)
    evidence = Evidence(id=str(uuid.uuid4()), tenant_id=ctx.tenant_id, sha256=body.sha256, filename=body.filename,
                        size_bytes=body.size_bytes, record_id=body.record_id, uploaded_by=ctx.user_id)
    repo.add_evidence(evidence)
    record_event(repo, ctx, request, action="evidence.upload_session", object_type="evidence", object_id=evidence.id,
                 payload={"sha256": body.sha256, "size_bytes": body.size_bytes, "record_id": body.record_id,
                          "duplicate_candidates": [d.id for d in duplicates]})
    data = {
        "evidence": serializers.evidence(evidence),
        "upload": _upload_descriptor(request, evidence.id),
        "duplicate_candidates": [serializers.evidence(d) for d in duplicates],
        "resolution_required": bool(duplicates),
    }
    idempotency.store(repo, ctx, "POST /v1/evidence/uploads", key, request_hash, 201, data)
    return ok(request, data, status_code=201)


@router.put("/uploads/{evidence_id}/content", summary="Kanıt içeriğini yükle (boyut/tür sınırı, karma doğrulaması, tarama)")
async def upload_content(evidence_id: str, request: Request, repo: Repo, ctx: Ctx):
    """Ham gövde. Beyan edilen sha256 ile içerik karması uyuşmazsa dosya saklanmaz (422 EVIDENCE_HASH_MISMATCH).
    Tarama kancası sonucu: clean | rejected | pending; `pending` kalan dosya indirilemez."""
    workflow.require_roles(ctx, workflow.EVIDENCE_ROLES)
    store = _store(request)
    evidence = repo.get_evidence(ctx.tenant_id, evidence_id)
    if evidence is None:
        raise not_found("Kanıt")
    if evidence.object_key is not None:
        raise ApiError(409, "EVIDENCE_ALREADY_UPLOADED", "Bu kanıt için içerik zaten yüklendi.")
    pol = request.app.state.security
    content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if content_type not in pol.evidence_allowed_types:
        raise ApiError(415, "EVIDENCE_TYPE_NOT_ALLOWED", "Dosya türü kabul edilmez.",
                       details={"content_type": content_type or None, "allowed": sorted(pol.evidence_allowed_types)})
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > pol.evidence_max_bytes:
        raise ApiError(413, "EVIDENCE_TOO_LARGE", "Dosya boyut sınırını aşıyor.", details={"max_bytes": pol.evidence_max_bytes})
    raw = await request.body()
    if len(raw) > pol.evidence_max_bytes:
        raise ApiError(413, "EVIDENCE_TOO_LARGE", "Dosya boyut sınırını aşıyor.", details={"max_bytes": pol.evidence_max_bytes})
    if not raw:
        raise ApiError(422, "VALIDATION_ERROR", "Boş gövde.", field_errors=[{"field": "body", "message": "Dosya içeriği gerekli."}])
    digest = hashlib.sha256(raw).hexdigest()
    if digest != evidence.sha256:
        raise ApiError(422, "EVIDENCE_HASH_MISMATCH", "İçerik karması beyan edilen sha256 ile uyuşmuyor; dosya saklanmadı.",
                       details={"declared": evidence.sha256, "computed": digest})
    import io

    try:
        object_key, _, size = store.put(ctx.tenant_id, evidence.id, io.BytesIO(raw), max_bytes=pol.evidence_max_bytes)
    except TooLarge:
        raise ApiError(413, "EVIDENCE_TOO_LARGE", "Dosya boyut sınırını aşıyor.", details={"max_bytes": pol.evidence_max_bytes})
    path = store.path_for(object_key)
    scan_status = request.app.state.scanner.scan(path, content_type) if path else "pending"
    if scan_status == "rejected":
        store.delete(object_key)
        updated = repo.update_evidence_object(ctx.tenant_id, evidence.id, object_key=None, content_type=content_type, scan_status="rejected")
    else:
        updated = repo.update_evidence_object(ctx.tenant_id, evidence.id, object_key=object_key, content_type=content_type, scan_status=scan_status)
    record_event(repo, ctx, request, action="evidence.upload_complete", object_type="evidence", object_id=evidence.id,
                 payload={"size_bytes": size, "content_type": content_type, "scan_status": scan_status,
                          "scanner": getattr(request.app.state.scanner, "kind", "custom")})
    return ok(request, serializers.evidence(updated), meta={"scanner": getattr(request.app.state.scanner, "kind", "custom")})


@router.get("/{evidence_id}", summary="Kanıt üst verisi")
def get_evidence(evidence_id: str, request: Request, repo: Repo, ctx: Ctx):
    workflow.require_roles(ctx, workflow.READ_ROLES)
    evidence = repo.get_evidence(ctx.tenant_id, evidence_id)
    if evidence is None:
        raise not_found("Kanıt")
    return ok(request, serializers.evidence(evidence))


@router.get("/{evidence_id}/download-url", summary="Kısa ömürlü imzalı indirme bağlantısı (yalnız taranmış dosya)")
def download_url(evidence_id: str, request: Request, repo: Repo, ctx: Ctx, ttl: int | None = Query(default=None, ge=10)):
    workflow.require_roles(ctx, workflow.READ_ROLES)
    evidence = repo.get_evidence(ctx.tenant_id, evidence_id)
    if evidence is None:
        raise not_found("Kanıt")
    signer = request.app.state.signer
    if signer is None:
        raise ApiError(503, "SIGNING_SECRET_MISSING", "İmzalı bağlantı sırrı ayarlı değil (KOZA_SIGNING_SECRET); imzasız bağlantı üretilmez.")
    if evidence.scan_status != "clean" or not evidence.object_key:
        raise ApiError(409, "EVIDENCE_NOT_AVAILABLE", "Dosya taranmadan veya yüklenmeden indirilemez.",
                       details={"scan_status": evidence.scan_status, "uploaded": evidence.object_key is not None})
    pol = request.app.state.security
    ttl = min(ttl or pol.signed_url_ttl, pol.signed_url_max_ttl)
    exp, sig = signer.sign(ctx.tenant_id, evidence.id, ttl)
    record_event(repo, ctx, request, action="evidence.download_url", object_type="evidence", object_id=evidence.id,
                 payload={"ttl_seconds": ttl, "expires_at": exp})
    return ok(request, {"url": f"/v1/evidence/files/{ctx.tenant_id}/{evidence.id}?exp={exp}&sig={sig}", "expires_at": exp,
                        "ttl_seconds": ttl, "filename": evidence.filename, "content_type": evidence.content_type})


@router.get("/files/{tenant_id}/{evidence_id}", summary="İmzalı dosya indirme (imza + süre doğrulanır)")
def download_file(tenant_id: str, evidence_id: str, request: Request, exp: int = Query(...), sig: str = Query(...)):
    """Bearer gerekmez; HMAC imzası ve süre doğrulanır. Süre dolunca 403. İmza yalnız bu tenant+kanıt için geçerlidir."""
    signer = request.app.state.signer
    if signer is None or not signer.verify(tenant_id, evidence_id, exp, sig):
        raise ApiError(403, "SIGNED_URL_INVALID", "Bağlantı geçersiz veya süresi dolmuş; yeni bağlantı isteyin.")
    store = _store(request)
    repo = request.app.state.repo
    opener = getattr(repo, "session", None)
    if opener is None:
        evidence = repo.get_evidence(tenant_id, evidence_id)
    else:
        with opener(tenant_id) as session:
            evidence = session.get_evidence(tenant_id, evidence_id)
    if evidence is None or evidence.scan_status != "clean" or not evidence.object_key:
        raise not_found("Kanıt")
    path = store.path_for(evidence.object_key)
    if path is None:
        raise not_found("Kanıt dosyası")
    return FileResponse(path, media_type=evidence.content_type or "application/octet-stream", filename=evidence.filename,
                        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})
