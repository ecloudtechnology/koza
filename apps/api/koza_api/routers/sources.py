"""Kaynak kayıt defteri (§19, §27 GET /v1/sources/{id}/versions).

Platform düzeyi (tenant'a bağlı değil): içerik editörü/admin taslak sürüm ekler (SRC-01..04), uzman kontrolör onaylar (SRC-06).
Tarih modeli ayrı alanlardır; eski sürüm erişilebilir kalır; sürüm içeriği değişmez (yeni sürüm eklenir).
Taslak yayın otomatik yükümlülük olamaz: `expert_approved=false` sürümler bilgilendirme amaçlıdır.
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Request

from .. import workflow
from ..audit import record_event
from ..calc import sha256_hex
from ..deps import Ctx, Repo
from ..envelope import ok
from ..errors import ApiError, not_found
from ..repo import ReferenceSource, ReferenceSourceVersion, utcnow_iso
from ..schemas import SourceCreate, SourceVersionCreate

router = APIRouter(prefix="/v1/sources", tags=["sources"])

DIFF_FIELDS = ("publication_date", "effective_date", "covered_period_start", "covered_period_end", "early_adoption_note",
               "content_hash", "content_url")


def _source(s: ReferenceSource) -> dict[str, Any]:
    return {"id": s.id, "name": s.name, "publisher": s.publisher, "url": s.url, "kind": s.kind, "license": s.license,
            "created_by": s.created_by, "created_at": s.created_at}


def _version(v: ReferenceSourceVersion, previous: ReferenceSourceVersion | None) -> dict[str, Any]:
    changes = []
    if previous is not None:
        for f in DIFF_FIELDS:
            if getattr(v, f) != getattr(previous, f):
                changes.append({"field": f, "from": getattr(previous, f), "to": getattr(v, f)})
    return {
        "source_id": v.source_id, "version": v.version,
        "dates": {
            "publication_date": v.publication_date, "effective_date": v.effective_date,
            "covered_period": {"start": v.covered_period_start, "end": v.covered_period_end},
            "early_adoption_note": v.early_adoption_note, "seen_at": v.seen_at, "last_checked_at": v.last_checked_at,
        },
        "content_hash": v.content_hash, "content_url": v.content_url, "change_card": v.change_card,
        "expert_approved": v.expert_approved, "approved_by": v.approved_by, "approved_at": v.approved_at,
        "binding": v.expert_approved,  # taslak yayın otomatik yükümlülük olamaz (§19)
        "changes_from_previous": changes, "created_by": v.created_by, "created_at": v.created_at,
    }


def _load(repo, source_id: str) -> ReferenceSource:
    s = repo.get_source(source_id)
    if s is None:
        raise not_found("Kaynak")
    return s


@router.post("", status_code=201, summary="Kaynak kaydet (SRC-01)")
def create_source(body: SourceCreate, request: Request, repo: Repo, ctx: Ctx):
    workflow.require_roles(ctx, workflow.SOURCE_WRITE_ROLES)
    source = ReferenceSource(id=str(uuid.uuid4()), name=body.name, publisher=body.publisher, url=body.url, kind=body.kind,
                             license=body.license, created_by=ctx.user_id)
    repo.add_source(source)
    record_event(repo, ctx, request, action="source.create", object_type="reference_source", object_id=source.id,
                 payload={"name": body.name, "publisher": body.publisher, "kind": body.kind})
    return ok(request, _source(source), status_code=201)


@router.get("", summary="Kaynakları listele")
def list_sources(request: Request, repo: Repo, ctx: Ctx):
    workflow.require_roles(ctx, workflow.CATALOG_READ_ROLES)
    return ok(request, [_source(s) for s in repo.list_sources()])


@router.get("/{source_id}", summary="Kaynağı oku")
def get_source(source_id: str, request: Request, repo: Repo, ctx: Ctx):
    workflow.require_roles(ctx, workflow.CATALOG_READ_ROLES)
    source = _load(repo, source_id)
    versions = repo.list_source_versions(source.id)
    return ok(request, {**_source(source), "latest_version": versions[-1].version if versions else None,
                        "latest_approved_version": max((v.version for v in versions if v.expert_approved), default=None)})


@router.get("/{source_id}/versions", summary="Kaynak sürümleri ve değişiklik listesi (§27)")
def list_versions(source_id: str, request: Request, repo: Repo, ctx: Ctx):
    workflow.require_roles(ctx, workflow.CATALOG_READ_ROLES)
    source = _load(repo, source_id)
    versions = repo.list_source_versions(source.id)
    out = [_version(v, versions[i - 1] if i else None) for i, v in enumerate(versions)]
    return ok(request, out, meta={"count": len(out), "approved_count": sum(1 for v in versions if v.expert_approved)})


@router.post("/{source_id}/versions", status_code=201, summary="Yeni kaynak sürümü (SRC-03/04; içerik karması zorunlu)")
def create_version(source_id: str, body: SourceVersionCreate, request: Request, repo: Repo, ctx: Ctx):
    """Aynı içerik karması son sürümle aynıysa 409 SOURCE_CONTENT_UNCHANGED (kontrol tarihi için `/checked` kullanın)."""
    workflow.require_roles(ctx, workflow.SOURCE_WRITE_ROLES)
    source = _load(repo, source_id)
    versions = repo.list_source_versions(source.id)
    content_hash = body.content_hash or sha256_hex(body.content or "")
    if versions and versions[-1].content_hash == content_hash:
        raise ApiError(409, "SOURCE_CONTENT_UNCHANGED", "İçerik karması son sürümle aynı; yeni sürüm gerekmez.",
                       details={"version": versions[-1].version, "checked_path": f"/v1/sources/{source.id}/versions/{versions[-1].version}/checked"})
    version = ReferenceSourceVersion(
        source_id=source.id, version=(versions[-1].version + 1) if versions else 1,
        publication_date=body.publication_date.isoformat() if body.publication_date else None,
        effective_date=body.effective_date.isoformat() if body.effective_date else None,
        covered_period_start=body.covered_period_start.isoformat() if body.covered_period_start else None,
        covered_period_end=body.covered_period_end.isoformat() if body.covered_period_end else None,
        early_adoption_note=body.early_adoption_note,
        seen_at=body.seen_at.isoformat() if body.seen_at else utcnow_iso(),
        last_checked_at=body.last_checked_at.isoformat() if body.last_checked_at else None,
        content_hash=content_hash, content_url=body.content_url, change_card=body.change_card.model_dump(mode="json"),
        expert_approved=False, approved_by=None, approved_at=None, created_by=ctx.user_id,
    )
    repo.add_source_version(version)
    record_event(repo, ctx, request, action="source.version_create", object_type="reference_source", object_id=source.id,
                 object_version=version.version, payload={"content_hash": content_hash, "effective_date": version.effective_date})
    return ok(request, _version(version, versions[-1] if versions else None), status_code=201)


@router.post("/{source_id}/versions/{version}/approve", summary="Uzman onayı (SRC-06; yalnız uzman kontrolör)")
def approve_version(source_id: str, version: int, request: Request, repo: Repo, ctx: Ctx):
    workflow.require_roles(ctx, workflow.SOURCE_APPROVE_ROLES)
    source = _load(repo, source_id)
    versions = repo.list_source_versions(source.id)
    target = next((v for v in versions if v.version == version), None)
    if target is None:
        raise not_found("Kaynak sürümü")
    if not target.expert_approved:
        target = repo.approve_source_version(source.id, version, ctx.user_id)
        record_event(repo, ctx, request, action="source.approve", object_type="reference_source", object_id=source.id,
                     object_version=version, payload={"content_hash": target.content_hash})
    idx = versions.index(next(v for v in versions if v.version == version))
    return ok(request, _version(target, versions[idx - 1] if idx else None))


@router.post("/{source_id}/versions/{version}/checked", summary="Son başarılı kontrol zamanını yaz (SRC-02)")
def mark_checked(source_id: str, version: int, request: Request, repo: Repo, ctx: Ctx):
    workflow.require_roles(ctx, workflow.SOURCE_WRITE_ROLES)
    source = _load(repo, source_id)
    target = repo.touch_source_version_checked(source.id, version)
    if target is None:
        raise not_found("Kaynak sürümü")
    versions = repo.list_source_versions(source.id)
    idx = next(i for i, v in enumerate(versions) if v.version == version)
    return ok(request, _version(target, versions[idx - 1] if idx else None))
