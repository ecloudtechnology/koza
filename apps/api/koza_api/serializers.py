"""Yanıt gövdeleri. Kural 2: quantity NULL / "0" / not_applicable ayrımı aynen taşınır."""

from __future__ import annotations

from typing import Any

from .repo import Approval, CalculationRun, Evidence, Period, PeriodReopen, Record, ReportSnapshot, Repository


def run_is_current(run: CalculationRun, record: Record) -> bool:
    return run.data_version == record.current.data_version


def current_runs(repo: Repository, record: Record) -> list[CalculationRun]:
    return sorted(
        (r for r in repo.list_runs(record.tenant_id, record.id) if run_is_current(r, record)),
        key=lambda r: r.created_at,
    )


def approved_run_id(repo: Repository, record: Record) -> str | None:
    """Mevcut veri sürümü için geçerli son onayın koşumu; veri değiştiyse None (onay geçersiz)."""
    cur = record.current
    if cur.state not in ("approved", "locked"):
        return None
    for a in reversed(repo.list_approvals(record.tenant_id, record.id)):
        if a.decision == "approved":
            run = repo.get_run(record.tenant_id, a.run_id) if a.run_id else None
            if run is None or run.data_version == cur.data_version:
                return a.run_id
            return None
    return None


def activity(repo: Repository, record: Record) -> dict[str, Any]:
    cur = record.current
    runs = current_runs(repo, record)
    return {
        "id": record.id,
        "period_id": record.period_id,
        "source_id": record.source_id,
        "version": cur.version,
        "data_version": cur.data_version,
        "state": cur.state,
        **cur.data(),
        "author_id": cur.author_id,
        "transition": cur.transition,
        "change_reason": cur.change_reason,
        "created_by": record.created_by,
        "created_at": record.created_at,
        "updated_at": cur.created_at,
        "latest_run_id": runs[-1].id if runs else None,
        "approved_run_id": approved_run_id(repo, record),
    }


def version_history(record: Record) -> list[dict[str, Any]]:
    return [
        {
            "version": v.version,
            "data_version": v.data_version,
            "state": v.state,
            "transition": v.transition,
            "change_reason": v.change_reason,
            "author_id": v.author_id,
            "created_at": v.created_at,
            **v.data(),
        }
        for v in record.versions
    ]


def run(r: CalculationRun) -> dict[str, Any]:
    return {
        "id": r.id,
        "record_id": r.record_id,
        "record_version": r.record_version,
        "data_version": r.data_version,
        "method": {"id": r.method_id, "version": r.method_version},
        "factor_refs": r.factor_refs,
        "engine_version": r.engine_version,
        "inputs_hash": r.inputs_hash,
        "status": r.status,
        "result": r.result,
        "run_by": r.run_by,
        "created_at": r.created_at,
    }


def approval(a: Approval) -> dict[str, Any]:
    return {
        "id": a.id,
        "record_id": a.record_id,
        "record_version": a.record_version,
        "run_id": a.run_id,
        "decision": a.decision,
        "decided_by": a.decided_by,
        "comment": a.comment,
        "self_approval": a.self_approval,
        "self_approval_reason": a.self_approval_reason,
        "created_at": a.created_at,
    }


def period(p: Period, reopens: list[PeriodReopen] | None = None) -> dict[str, Any]:
    return {
        "id": p.id,
        "start_date": p.start_date,
        "end_date": p.end_date,
        "status": p.status,
        "locked_at": p.locked_at,
        "locked_by": p.locked_by,
        "reopens": [
            {
                "id": r.id,
                "reason": r.reason,
                "impact_note": r.impact_note,
                "requested_by": r.requested_by,
                "approved_by": r.approved_by,
                "created_at": r.created_at,
            }
            for r in (reopens or [])
        ],
    }


def report(r: ReportSnapshot, *, include_manifest: bool = True) -> dict[str, Any]:
    out = {
        "id": r.id,
        "job_id": r.id,
        "status": "ready",
        "period_id": r.period_id,
        "version": r.version,
        "manifest_sha256": r.manifest_sha256,
        "supersedes_id": r.supersedes_id,
        "supersede_reason": r.supersede_reason,
        "created_by": r.created_by,
        "created_at": r.created_at,
        "file": None,  # rapor dosyası (DOCX/PDF) henüz üretilmiyor
    }
    if include_manifest:
        out["manifest"] = r.manifest
    return out


def evidence(e: Evidence) -> dict[str, Any]:
    return {
        "id": e.id,
        "sha256": e.sha256,
        "filename": e.filename,
        "size_bytes": e.size_bytes,
        "record_id": e.record_id,
        "scan_status": e.scan_status,
        "uploaded_by": e.uploaded_by,
        "created_at": e.created_at,
    }
