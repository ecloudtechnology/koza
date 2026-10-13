"""Faaliyet kayıtları: oluştur (idempotent), oku, güncelle (sürüm kontrollü), gönder."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Request

from .. import idempotency, serializers, workflow
from ..audit import record_event
from ..deps import Ctx, Repo
from ..envelope import ok
from ..errors import ApiError, not_found
from ..repo import Record, RecordVersion
from ..schemas import ActivityCreate, ActivityPatch, SubmitRequest

router = APIRouter(prefix="/v1/activities", tags=["activities"])


def _etag(version: int) -> dict[str, str]:
    return {"ETag": f'"{version}"'}


def _parse_if_match(request: Request) -> int | None:
    raw = request.headers.get("if-match", "").strip()
    if not raw:
        return None
    raw = raw.removeprefix("W/").strip('"')
    if not raw.isdigit():
        raise ApiError(400, "IF_MATCH_INVALID", "If-Match başlığı sürüm numarası olmalı.")
    return int(raw)


def _load(repo, ctx, record_id: str) -> Record:
    record = repo.get_record(ctx.tenant_id, record_id)
    if record is None:
        raise not_found("Kayıt")  # yabancı kurum → aynı 404 (§27)
    return record


@router.post("", status_code=201, summary="Taslak oluştur (Idempotency-Key zorunlu)")
def create_activity(body: ActivityCreate, request: Request, repo: Repo, ctx: Ctx):
    """201 + kayıt/sürüm. Aynı Idempotency-Key + aynı gövde → aynı yanıt; farklı gövde → 409 IDEMPOTENCY_MISMATCH.
    Gövdede `tenant_id` kabul edilmez (422); kurum bağlamı X-Tenant + üyelikten gelir."""
    workflow.require_roles(ctx, workflow.CREATE_ROLES)
    key = idempotency.get_key(request, required=True)
    payload = body.model_dump(mode="json")
    request_hash, previous = idempotency.lookup(repo, ctx, "POST /v1/activities", key, payload)
    if previous is not None:
        return ok(request, previous.response, status_code=previous.status_code,
                  meta={"idempotent_replay": True}, headers=_etag(previous.response["version"]))

    period = repo.get_period(ctx.tenant_id, body.period_id)
    if period is None:
        raise ApiError(422, "VALIDATION_ERROR", "Alan hatası.",
                       field_errors=[{"field": "period_id", "message": "Dönem bulunamadı."}])
    workflow.ensure_period_open(period)

    record = Record(id=str(uuid.uuid4()), tenant_id=ctx.tenant_id, period_id=body.period_id,
                    source_id=body.source_id, created_by=ctx.user_id)
    repo.add_record(record)
    repo.append_version(RecordVersion(
        tenant_id=ctx.tenant_id, record_id=record.id, version=1, data_version=1, state=workflow.DRAFT,
        source_type=body.source_type, fuel=body.fuel, quantity=body.quantity, quantity_state=body.quantity_state,
        not_applicable_reason=body.not_applicable_reason, unit=body.unit,
        heating_value_basis=body.heating_value_basis, data_quality=body.data_quality,
        activity_start=body.activity_start.isoformat(), activity_end=body.activity_end.isoformat(),
        note=body.note, author_id=ctx.user_id, transition="create", change_reason=None,
    ))
    record_event(repo, ctx, request, action="activity.create", object_type="activity_record",
                 object_id=record.id, object_version=1, payload={"quantity_state": body.quantity_state})
    data = serializers.activity(repo, record)
    idempotency.store(repo, ctx, "POST /v1/activities", key, request_hash, 201, data)
    return ok(request, data, status_code=201, headers=_etag(1))


@router.get("/{record_id}", summary="Kaydı oku")
def get_activity(record_id: str, request: Request, repo: Repo, ctx: Ctx):
    workflow.require_roles(ctx, workflow.READ_ROLES)
    record = _load(repo, ctx, record_id)
    return ok(request, serializers.activity(repo, record), headers=_etag(record.current.version))


@router.get("/{record_id}/versions", summary="Sürüm geçmişi (append-only)")
def get_activity_versions(record_id: str, request: Request, repo: Repo, ctx: Ctx):
    workflow.require_roles(ctx, workflow.READ_ROLES)
    record = _load(repo, ctx, record_id)
    return ok(request, serializers.version_history(record))


@router.patch("/{record_id}", summary="Kaydı güncelle (beklenen sürüm zorunlu)")
def patch_activity(record_id: str, body: ActivityPatch, request: Request, repo: Repo, ctx: Ctx):
    """If-Match: "<version>" veya gövde `expected_version` zorunlu (428). Uyuşmazlık → 409 VERSION_CONFLICT,
    gövdede güncel sürüm (T18). Kilitli dönem → 409 PERIOD_LOCKED (T17). Onaylı kayıtta veri değişikliği →
    durum validation_required, onay geçersizleşir (§21)."""
    record = _load(repo, ctx, record_id)
    period = repo.get_period(ctx.tenant_id, record.period_id)
    assert period is not None
    expected = _parse_if_match(request)
    if expected is None:
        expected = body.expected_version
    if expected is None:
        raise ApiError(428, "VERSION_REQUIRED", "Beklenen sürüm zorunlu: If-Match başlığı veya expected_version.")
    current = record.current
    if expected != current.version:
        raise ApiError(
            409, "VERSION_CONFLICT",
            "Kayıt başka bir kullanıcı tarafından değiştirildi; güncel sürümü alıp yeniden deneyin.",
            details={"current_version": current.version, "expected_version": expected,
                     "current_state": current.state, "updated_at": current.created_at},
        )
    next_state = workflow.check_edit(ctx, record, period)
    changes = body.changes()
    if not changes:
        raise ApiError(422, "VALIDATION_ERROR", "Değiştirilecek alan yok.",
                       field_errors=[{"field": "body", "message": "En az bir alan verin."}])
    merged = {**current.data(), **changes}
    try:
        from ..schemas import _check_value_state
        _check_value_state(merged["quantity"], merged["quantity_state"], merged["not_applicable_reason"])
        if merged["activity_end"] < merged["activity_start"]:
            raise ValueError("activity_end, activity_start'tan önce olamaz")
    except ValueError as exc:
        raise ApiError(422, "VALIDATION_ERROR", "Alan hatası.", field_errors=[{"field": "quantity", "message": str(exc)}])

    invalidated = workflow.approval_invalidated_by_edit(current)
    new_version = current.version + 1
    repo.append_version(RecordVersion(
        tenant_id=ctx.tenant_id, record_id=record.id, version=new_version, data_version=new_version,
        state=next_state, author_id=ctx.user_id, transition="update", change_reason=body.change_reason,
        **merged,
    ))
    record_event(repo, ctx, request, action="activity.update", object_type="activity_record",
                 object_id=record.id, object_version=new_version, reason=body.change_reason,
                 payload={"fields": sorted(changes.keys()), "from_state": current.state, "to_state": next_state})
    if invalidated:
        record_event(repo, ctx, request, action="approval.invalidated", object_type="activity_record",
                     object_id=record.id, object_version=new_version,
                     reason="Onaylı veri değişti; yeniden inceleme gerekli (§21).",
                     payload={"previous_version": current.version})
    data = serializers.activity(repo, record)
    meta = {"approval_invalidated": invalidated, "review_required": next_state == workflow.VALIDATION_REQUIRED}
    return ok(request, data, meta=meta, headers=_etag(new_version))


@router.post("/{record_id}/submit", summary="Kontrole gönder")
def submit_activity(record_id: str, request: Request, repo: Repo, ctx: Ctx, body: SubmitRequest | None = None):
    """calculated → in_review. Güncel veri sürümü için geçerli (bloke olmayan) koşum şarttır;
    gerekçeli 'uygulanamaz' kayıt hesapsız gönderilebilir."""
    record = _load(repo, ctx, record_id)
    period = repo.get_period(ctx.tenant_id, record.period_id)
    assert period is not None
    runs = [r for r in serializers.current_runs(repo, record) if r.status != "blocked"]
    workflow.check_submit(ctx, record, period, has_valid_run=bool(runs))
    current = record.current
    new_version = current.version + 1
    repo.append_version(RecordVersion(
        tenant_id=ctx.tenant_id, record_id=record.id, version=new_version, data_version=current.data_version,
        state=workflow.IN_REVIEW, author_id=ctx.user_id, transition="submit",
        change_reason=body.note if body else None, **current.data(),
    ))
    record_event(repo, ctx, request, action="activity.submit", object_type="activity_record",
                 object_id=record.id, object_version=new_version,
                 payload={"run_id": runs[-1].id if runs else None, "missing_evidence_policy": "not_enforced_in_dilim0"})
    return ok(request, serializers.activity(repo, record), headers=_etag(new_version))


@router.get("/{record_id}/runs", summary="Hesap koşumları (tümü korunur, T13)")
def list_runs(record_id: str, request: Request, repo: Repo, ctx: Ctx):
    workflow.require_roles(ctx, workflow.READ_ROLES)
    record = _load(repo, ctx, record_id)
    runs = sorted(repo.list_runs(ctx.tenant_id, record.id), key=lambda r: r.created_at, reverse=True)
    data = [{**serializers.run(r), "is_current_data": serializers.run_is_current(r, record)} for r in runs]
    return ok(request, data, meta={"approved_run_id": serializers.approved_run_id(repo, record)})
