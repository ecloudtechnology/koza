"""Raporlama dönemi: oluştur, oku, kilitle, gerekçeyle yeniden aç (§21, T17)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Request

from .. import serializers, workflow
from ..audit import record_event
from ..deps import Ctx, Repo
from ..envelope import ok
from ..errors import not_found
from ..repo import Period, PeriodReopen, RecordVersion
from ..schemas import PeriodCreate, PeriodLockRequest, PeriodReopenRequest

router = APIRouter(prefix="/v1/periods", tags=["periods"])


def _load(repo, ctx, period_id: str) -> Period:
    period = repo.get_period(ctx.tenant_id, period_id)
    if period is None:
        raise not_found("Dönem")
    return period


@router.post("", status_code=201, summary="Dönem oluştur")
def create_period(body: PeriodCreate, request: Request, repo: Repo, ctx: Ctx):
    workflow.require_roles(ctx, workflow.PERIOD_MANAGE_ROLES)
    period = Period(id=str(uuid.uuid4()), tenant_id=ctx.tenant_id,
                    start_date=body.start_date.isoformat(), end_date=body.end_date.isoformat())
    repo.add_period(period)
    record_event(repo, ctx, request, action="period.create", object_type="reporting_period", object_id=period.id)
    return ok(request, serializers.period(period), status_code=201)


@router.get("", summary="Dönemleri listele")
def list_periods(request: Request, repo: Repo, ctx: Ctx):
    workflow.require_roles(ctx, workflow.READ_ROLES)
    return ok(request, [serializers.period(p, repo.list_period_reopens(ctx.tenant_id, p.id)) for p in repo.list_periods(ctx.tenant_id)])


@router.get("/{period_id}", summary="Dönemi oku")
def get_period(period_id: str, request: Request, repo: Repo, ctx: Ctx):
    workflow.require_roles(ctx, workflow.READ_ROLES)
    period = _load(repo, ctx, period_id)
    return ok(request, serializers.period(period, repo.list_period_reopens(ctx.tenant_id, period.id)))


@router.post("/{period_id}/lock", summary="Dönemi kilitle (admin)")
def lock_period(period_id: str, request: Request, repo: Repo, ctx: Ctx, body: PeriodLockRequest | None = None):
    """Tüm kayıtlar onaylı olmalı (aksi 409 PERIOD_NOT_READY). Onaylı kayıtlar `locked` sürümü alır."""
    period = _load(repo, ctx, period_id)
    records = repo.list_records(ctx.tenant_id, period.id)
    workflow.check_lock(ctx, period, records)
    repo.set_period_status(ctx.tenant_id, period.id, "locked", ctx.user_id)
    for record in records:
        cur = record.current
        repo.append_version(RecordVersion(
            tenant_id=ctx.tenant_id, record_id=record.id, version=cur.version + 1, data_version=cur.data_version,
            state=workflow.LOCKED, author_id=ctx.user_id, transition="period.lock",
            change_reason=body.note if body else None, **cur.data(),
        ))
    record_event(repo, ctx, request, action="period.lock", object_type="reporting_period", object_id=period.id,
                 reason=body.note if body else None, payload={"records": len(records)})
    return ok(request, serializers.period(period, repo.list_period_reopens(ctx.tenant_id, period.id)))


@router.post("/{period_id}/reopen", summary="Kilitli dönemi yeniden aç (admin, gerekçe zorunlu)")
def reopen_period(period_id: str, body: PeriodReopenRequest, request: Request, repo: Repo, ctx: Ctx):
    """Gerekçe + onaylayan kaydedilir; eski rapor sürümleri korunur (silme ucu yoktur).
    Kilitli kayıtlar `approved` durumuna döner; veri değişirse olağan akışla onay geçersizleşir."""
    period = _load(repo, ctx, period_id)
    workflow.check_reopen(ctx, period, body.reason)
    reopen = PeriodReopen(id=str(uuid.uuid4()), tenant_id=ctx.tenant_id, period_id=period.id,
                          reason=body.reason, impact_note=body.impact_note,
                          requested_by=ctx.user_id, approved_by=ctx.user_id)
    repo.add_period_reopen(reopen)
    repo.set_period_status(ctx.tenant_id, period.id, "open", ctx.user_id)
    for record in repo.list_records(ctx.tenant_id, period.id):
        cur = record.current
        if cur.state == workflow.LOCKED:
            repo.append_version(RecordVersion(
                tenant_id=ctx.tenant_id, record_id=record.id, version=cur.version + 1, data_version=cur.data_version,
                state=workflow.APPROVED, author_id=ctx.user_id, transition="period.reopen",
                change_reason=body.reason, **cur.data(),
            ))
    record_event(repo, ctx, request, action="period.reopen", object_type="reporting_period", object_id=period.id,
                 reason=body.reason, payload={"reopen_id": reopen.id, "impact_note": body.impact_note,
                                               "retained_reports": [r.id for r in repo.list_reports(ctx.tenant_id, period.id)]})
    return ok(request, serializers.period(period, repo.list_period_reopens(ctx.tenant_id, period.id)))
