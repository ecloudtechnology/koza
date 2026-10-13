"""Rapor anlık görüntüsü: sabit manifest + sha256 (§22, T19)."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Request

from .. import serializers, workflow
from ..audit import record_event
from ..calc import canonical_json, sha256_hex
from ..deps import Ctx, Repo
from ..envelope import ok
from ..errors import ApiError, not_found
from ..repo import Record, ReportSnapshot, Repository
from ..schemas import ReportCreate

router = APIRouter(prefix="/v1/reports", tags=["reports"])

MANIFEST_SCHEMA_VERSION = 1


def _record_entry(repo: Repository, record: Record) -> dict[str, Any]:
    cur = record.current
    run_id = serializers.approved_run_id(repo, record)
    run = repo.get_run(record.tenant_id, run_id) if run_id else None
    entry: dict[str, Any] = {
        "record_id": record.id,
        "version": cur.version,
        "data_version": cur.data_version,
        "state": cur.state,
        "source_type": cur.source_type,
        "fuel": cur.fuel,
        # kural 2: NULL / "0" / not_applicable ayrımı raporda korunur
        "quantity": cur.quantity,
        "quantity_state": cur.quantity_state,
        "not_applicable_reason": cur.not_applicable_reason,
        "unit": cur.unit,
        "data_quality": cur.data_quality,
        "activity_start": cur.activity_start,
        "activity_end": cur.activity_end,
        "included_as_approved": cur.state in ("approved", "locked"),
        "run": None,
    }
    if run is not None:
        entry["run"] = {
            "run_id": run.id,
            "inputs_hash": run.inputs_hash,
            "status": run.status,
            "engine_version": run.engine_version,
            "method": {"id": run.method_id, "version": run.method_version},
            "factors": sorted(run.factor_refs, key=lambda f: (f["id"], f["version"])),
            "total_co2e_kg": run.result.get("total_co2e_kg"),
            "coverage": run.result.get("coverage"),
            "boundary": run.result.get("boundary"),
            "claim_tr": run.result.get("claim_tr"),
        }
    return entry


def build_manifest(repo: Repository, tenant_id: str, period_id: str) -> dict[str, Any]:
    """Deterministik: zaman damgası ve rapor kimliği içermez; aynı girdiler aynı sha256 verir (T19).
    Toplam üretmez: toplulaştırma da hesap motorunun işidir (kural 1); Dilim 0'da yalnız kayıt bazlı sonuç listelenir."""
    period = repo.get_period(tenant_id, period_id)
    assert period is not None
    records = sorted(repo.list_records(tenant_id, period_id), key=lambda r: r.id)
    entries = [_record_entry(repo, r) for r in records]
    factors = sorted({(f["id"], f["version"]) for e in entries if e["run"] for f in e["run"]["factors"]})
    methods = sorted({(e["run"]["method"]["id"], e["run"]["method"]["version"]) for e in entries if e["run"]})
    engines = sorted({e["run"]["engine_version"] for e in entries if e["run"]})
    states = sorted({e["state"] for e in entries})
    return {
        "manifest_schema_version": MANIFEST_SCHEMA_VERSION,
        "period": {"id": period.id, "start_date": period.start_date, "end_date": period.end_date, "status": period.status},
        "records": entries,
        "factors": [{"id": i, "version": v} for i, v in factors],
        "methods": [{"id": i, "version": v} for i, v in methods],
        "engine_versions": engines,
        "counts": {
            "records": len(entries),
            "approved": sum(1 for e in entries if e["included_as_approved"]),
            "not_approved": sum(1 for e in entries if not e["included_as_approved"]),
            "quantity_unknown": sum(1 for e in entries if e["quantity_state"] == "unknown"),
            "not_applicable": sum(1 for e in entries if e["quantity_state"] == "not_applicable"),
            "estimated": sum(1 for e in entries if e["data_quality"] == "estimated"),
        },
        "states_present": states,
        "assurance": None,  # platform kendi kendine güvence etiketi veremez (§22)
    }


@router.post("", status_code=202, summary="Rapor oluştur (sabit manifest)")
def create_report(body: ReportCreate, request: Request, repo: Repo, ctx: Ctx):
    """Şartname 202 + job_id öngörür (§27). Dilim 0'da kuyruk yoktur: manifest SENKRON üretilir ve yanıt
    202 ile `status: "ready"`, `job_id` = rapor kimliği döner. Önceki rapor sürümü varsa `supersede_reason`
    zorunludur; eski sürüm korunur (kural 9). Rapor dosyası (DOCX/PDF) henüz üretilmez."""
    workflow.require_roles(ctx, workflow.REPORT_ROLES)
    period = repo.get_period(ctx.tenant_id, body.period_id)
    if period is None:
        raise not_found("Dönem")
    previous = sorted(repo.list_reports(ctx.tenant_id, period.id), key=lambda r: r.version)
    if previous and not (body.supersede_reason and body.supersede_reason.strip()):
        raise ApiError(422, "SUPERSEDE_REASON_REQUIRED",
                       "Bu dönem için rapor sürümü var; yeni sürümün nedeni belirtilmeli.",
                       field_errors=[{"field": "supersede_reason", "message": "Zorunlu."}],
                       details={"previous_report_id": previous[-1].id, "previous_version": previous[-1].version})
    manifest = build_manifest(repo, ctx.tenant_id, period.id)
    digest = sha256_hex(canonical_json(manifest))
    report = ReportSnapshot(
        id=str(uuid.uuid4()), tenant_id=ctx.tenant_id, period_id=period.id,
        version=(previous[-1].version + 1) if previous else 1, manifest=manifest, manifest_sha256=digest,
        supersedes_id=previous[-1].id if previous else None,
        supersede_reason=body.supersede_reason if previous else None, created_by=ctx.user_id,
    )
    repo.add_report(report)
    record_event(repo, ctx, request, action="report.create", object_type="report_snapshot", object_id=report.id,
                 object_version=report.version, reason=report.supersede_reason,
                 payload={"period_id": period.id, "manifest_sha256": digest, "supersedes_id": report.supersedes_id,
                          "unchanged_from_previous": bool(previous) and previous[-1].manifest_sha256 == digest})
    meta = {"async": False, "note": "Dilim 0: rapor senkron üretildi; kuyruk yok."}
    return ok(request, serializers.report(report), status_code=202, meta=meta)


@router.get("/{report_id}", summary="Raporu oku / indir")
def get_report(report_id: str, request: Request, repo: Repo, ctx: Ctx):
    workflow.require_roles(ctx, workflow.READ_ROLES)
    report = repo.get_report(ctx.tenant_id, report_id)
    if report is None:
        raise not_found("Rapor")
    return ok(request, serializers.report(report))
