"""Hesap: önizleme (kalıcı değil) ve kayıt üzerinde koşum (değişmez)."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Request

from .. import serializers, workflow
from ..audit import record_event
from ..calc import build_engine_request, run_engine
from ..deps import Ctx, Repo
from ..envelope import ok
from ..errors import ApiError, not_found
from ..repo import CalculationRun, RecordVersion
from ..schemas import CalculateRequest, FactorRef, MethodRef, PreviewRequest

router = APIRouter(prefix="/v1", tags=["calculations"])


def _resolve_catalog(repo, factor_refs: list[FactorRef], method_ref: MethodRef) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    factors, errors = [], []
    for ref in factor_refs:
        f = repo.get_factor(ref.id, ref.version)
        if f is None:
            errors.append({"field": "factor_refs", "message": f"Faktör bulunamadı: {ref.id}@{ref.version}"})
        else:
            factors.append(f)
    method = repo.get_method(method_ref.id, method_ref.version)
    if method is None:
        errors.append({"field": "method", "message": f"Yöntem bulunamadı: {method_ref.id}@{method_ref.version}"})
    if errors:
        raise ApiError(422, "VALIDATION_ERROR", "Faktör/yöntem sürümü bulunamadı.", field_errors=errors)
    return factors, method


@router.post("/calculations/preview", summary="Hesap önizle (hiçbir şey saklanmaz)")
def preview(body: PreviewRequest, request: Request, repo: Repo, ctx: Ctx):
    """Girdi/faktör/yöntem sürümü ve motor sonucu döner; kayıt, koşum veya audit YAZILMAZ."""
    workflow.require_roles(ctx, workflow.CALCULATE_ROLES)
    factors, method = _resolve_catalog(repo, body.factor_refs, body.method)
    a = body.activity
    version = RecordVersion(
        tenant_id=ctx.tenant_id, record_id="preview", version=0, data_version=0, state="draft",
        source_type=a.source_type, fuel=a.fuel, quantity=a.quantity, quantity_state="known",
        not_applicable_reason=None, unit=a.unit, heating_value_basis=a.heating_value_basis,
        data_quality=a.data_quality, activity_start=a.activity_start.isoformat(),
        activity_end=a.activity_end.isoformat(), note=None, author_id=ctx.user_id, transition="preview",
        change_reason=None,
    )
    engine_request = build_engine_request(
        record_id="preview", data_version=0, version=version, factors=factors, method=method,
        calorific_value=body.calorific_value, basis_conversion=body.basis_conversion,
        reference_conditions=body.reference_conditions,
    )
    result, engine_version = run_engine(engine_request)
    return ok(request, {"persisted": False, "engine_version": engine_version, "request": engine_request, "result": result})


@router.post("/activities/{record_id}/calculate", status_code=201, summary="Hesapla (değişmez koşum ekler)")
def calculate(record_id: str, body: CalculateRequest, request: Request, repo: Repo, ctx: Ctx):
    """Her çağrı yeni bir calculation_run + result ekler; önceki koşumlar silinmez (T13).
    Onaylı kayıtta yeni koşum durumu değiştirmez; onay eski koşuma bağlı kalır, yeni koşum öneri olarak listelenir."""
    record = repo.get_record(ctx.tenant_id, record_id)
    if record is None:
        raise not_found("Kayıt")
    period = repo.get_period(ctx.tenant_id, record.period_id)
    assert period is not None
    workflow.check_calculate(ctx, record, period)
    factors, method = _resolve_catalog(repo, body.factor_refs, body.method)
    current = record.current
    engine_request = build_engine_request(
        record_id=record.id, data_version=current.data_version, version=current, factors=factors, method=method,
        calorific_value=body.calorific_value, basis_conversion=body.basis_conversion,
        reference_conditions=body.reference_conditions,
    )
    result, engine_version = run_engine(engine_request)
    previous_ids = [r.id for r in serializers.current_runs(repo, record)]
    run = CalculationRun(
        id=str(uuid.uuid4()), tenant_id=ctx.tenant_id, record_id=record.id,
        record_version=current.version, data_version=current.data_version,
        method_id=body.method.id, method_version=body.method.version, engine_version=engine_version,
        factor_refs=[{"id": f.id, "version": f.version} for f in body.factor_refs],
        request=engine_request, inputs_hash=result["inputs_hash"], status=result["status"],
        result=result, run_by=ctx.user_id,
    )
    repo.add_run(run)
    next_state = workflow.state_after_calculate(current, result["status"])
    new_version = current.version
    if next_state is not None and next_state != current.state:
        new_version = current.version + 1
        repo.append_version(RecordVersion(
            tenant_id=ctx.tenant_id, record_id=record.id, version=new_version, data_version=current.data_version,
            state=next_state, author_id=ctx.user_id, transition="calculate", change_reason=None, **current.data(),
        ))
    record_event(repo, ctx, request, action="calculation.run", object_type="calculation_run", object_id=run.id,
                 object_version=None,
                 payload={"record_id": record.id, "record_version": new_version, "status": result["status"],
                          "engine_version": engine_version, "factor_refs": run.factor_refs,
                          "method": {"id": run.method_id, "version": run.method_version}})
    data = {**serializers.run(run), "record_state": record.current.state, "record_version": new_version,
            "supersedes_run_ids": previous_ids}
    return ok(request, data, status_code=201, headers={"ETag": f'"{new_version}"'})
