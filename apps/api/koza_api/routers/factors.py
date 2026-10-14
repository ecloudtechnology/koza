"""Faktör ve yöntem kataloğu (§18, T13). Platform düzeyi; kural 12: test-only lisanslı faktör API ile eklenemez.

- Yeni sürüm ekleme ve etkinleştirme yalnız uzman kontrolör; `source_ref` zorunlu.
- Etkinleştirme eski koşumları DEĞİŞTİRMEZ; çağıran kurumdaki etkilenen kayıtların listesini döner (yeni koşum öneri olarak
  ayrıca çalıştırılır; onaylı sonuç korunur).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query, Request

from .. import serializers, workflow
from ..audit import record_event
from ..deps import Ctx, Repo
from ..envelope import ok
from ..errors import ApiError, not_found
from ..schemas import FactorVersionCreate

router = APIRouter(prefix="/v1", tags=["catalog"])


@router.get("/factors", summary="Faktör kataloğu")
def list_factors(request: Request, repo: Repo, ctx: Ctx, factor_id: str | None = Query(default=None),
                 status: str | None = Query(default=None, pattern="^(draft|active|retired)$")):
    workflow.require_roles(ctx, workflow.CATALOG_READ_ROLES)
    factors = repo.list_factors(factor_id=factor_id, status=status)
    return ok(request, factors, meta={"count": len(factors)})


@router.get("/factors/{factor_id}/versions", summary="Faktör sürümleri")
def factor_versions(factor_id: str, request: Request, repo: Repo, ctx: Ctx):
    workflow.require_roles(ctx, workflow.CATALOG_READ_ROLES)
    factors = repo.list_factors(factor_id=factor_id)
    if not factors:
        raise not_found("Faktör")
    return ok(request, factors)


@router.post("/factors/{factor_id}/versions", status_code=201, summary="Faktör sürümü ekle (uzman kontrolör; source_ref zorunlu)")
def create_factor_version(factor_id: str, body: FactorVersionCreate, request: Request, repo: Repo, ctx: Ctx):
    workflow.require_roles(ctx, workflow.FACTOR_MANAGE_ROLES)
    if body.license.strip().lower() == "test-only":
        raise ApiError(422, "VALIDATION_ERROR", "Test faktörü üretim kataloğuna giremez (kural 12).",
                       field_errors=[{"field": "license", "message": "test-only lisans kabul edilmez."}])
    if repo.get_factor(factor_id, body.version) is not None:
        raise ApiError(409, "FACTOR_VERSION_EXISTS", "Bu faktör sürümü zaten var; değer değişmez, yeni sürüm ekleyin.",
                       details={"factor_id": factor_id, "version": body.version})
    factor: dict[str, Any] = {"id": factor_id, **body.model_dump(mode="json"), "status": "draft", "created_by": ctx.user_id}
    repo.add_factor(factor)
    stored = repo.get_factor(factor_id, body.version)
    record_event(repo, ctx, request, action="factor.version_create", object_type="factor_version", object_id=factor_id,
                 payload={"version": body.version, "source_ref": body.source_ref, "gas": body.gas, "status": "draft"})
    return ok(request, stored, status_code=201)


def _affected_records(repo, tenant_id: str, factor_id: str, new_version: str) -> list[dict[str, Any]]:
    """Güncel veri sürümü için bu faktörün BAŞKA bir sürümünü kullanan kayıtlar (eski koşumlar değişmez)."""
    out = []
    for record in repo.list_records(tenant_id):
        runs = serializers.current_runs(repo, record)
        if not runs:
            continue
        run = runs[-1]
        used = [f for f in run.factor_refs if f["id"] == factor_id]
        if not used or all(f["version"] == new_version for f in used):
            continue
        out.append({"record_id": record.id, "state": record.current.state, "run_id": run.id,
                    "factor_version_used": used[0]["version"],
                    "approved_run_id": serializers.approved_run_id(repo, record),
                    "action_tr": "Yeni sürümle yeniden hesaplayın; onaylı sonuç korunur, yeni koşum öneri olarak listelenir."})
    return sorted(out, key=lambda r: r["record_id"])


@router.post("/factors/{factor_id}/versions/{version}/activate", summary="Faktör sürümünü etkinleştir (T13: eski koşumlar değişmez)")
def activate_factor_version(factor_id: str, version: str, request: Request, repo: Repo, ctx: Ctx):
    workflow.require_roles(ctx, workflow.FACTOR_MANAGE_ROLES)
    factor = repo.get_factor(factor_id, version)
    if factor is None:
        raise not_found("Faktör sürümü")
    if factor.get("status") == "retired":
        raise ApiError(409, "FACTOR_RETIRED", "Emekli sürüm yeniden etkinleştirilemez; yeni sürüm ekleyin.")
    retired = []
    for other in repo.list_factors(factor_id=factor_id, status="active"):
        if other["version"] != version:
            repo.set_factor_status(factor_id, other["version"], "retired", ctx.user_id)
            retired.append(other["version"])
    activated = repo.set_factor_status(factor_id, version, "active", ctx.user_id)
    affected = _affected_records(repo, ctx.tenant_id, factor_id, version)
    record_event(repo, ctx, request, action="factor.activate", object_type="factor_version", object_id=factor_id,
                 payload={"version": version, "retired_versions": retired, "affected_records": len(affected),
                          "source_ref": activated.get("source_ref")})
    return ok(request, {
        "factor": activated, "retired_versions": retired, "affected_records": affected,
        "note_tr": "Mevcut koşumlar ve onaylar değişmedi. Etkilenen kayıtlar için yeniden hesap önerilir; onaylı kayıtta yeni koşum öneri olarak eklenir.",
    })


@router.get("/methods", summary="Yöntem kataloğu")
def list_methods(request: Request, repo: Repo, ctx: Ctx):
    workflow.require_roles(ctx, workflow.CATALOG_READ_ROLES)
    methods = repo.list_methods()
    supported = None
    try:
        from koza_calc import SUPPORTED  # type: ignore[import-not-found]

        supported = SUPPORTED
    except ImportError:
        supported = None
    return ok(request, {"methods": methods, "engine_supported_matrix": supported})
