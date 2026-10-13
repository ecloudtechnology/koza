"""Kanıt yükleme oturumu (§27) — yalnız meta veri; nesne deposu yok."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Request

from .. import idempotency, serializers, workflow
from ..audit import record_event
from ..deps import Ctx, Repo
from ..envelope import ok
from ..errors import not_found
from ..repo import Evidence
from ..schemas import EvidenceUploadRequest

router = APIRouter(prefix="/v1/evidence", tags=["evidence"])


@router.post("/uploads", status_code=201, summary="Kanıt yükleme kaydı (sha256 + ad + boyut)")
def create_upload(body: EvidenceUploadRequest, request: Request, repo: Repo, ctx: Ctx):
    """Yalnız sha256, dosya adı ve boyut alınır; kurum içinde aynı karma varsa `duplicate_candidates`
    listelenir (T07). GERÇEK NESNE DEPOSU UYGULANMADI: `upload` alanı null döner, dosya alınmaz,
    `scan_status` 'pending' kalır. Kanıt tarama tamamlanmadan kullanılamaz."""
    workflow.require_roles(ctx, workflow.EVIDENCE_ROLES)
    if body.record_id is not None and repo.get_record(ctx.tenant_id, body.record_id) is None:
        raise not_found("Kayıt")
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
        "upload": None,  # imzalı yükleme bağlantısı: nesne deposu bağlanınca
        "duplicate_candidates": [serializers.evidence(d) for d in duplicates],
        "resolution_required": bool(duplicates),
    }
    idempotency.store(repo, ctx, "POST /v1/evidence/uploads", key, request_hash, 201, data)
    return ok(request, data, status_code=201)
