"""Onay / düzeltme kararı (§21, §04 görevlerin ayrılığı)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Request

from .. import idempotency, serializers, workflow
from ..audit import record_event
from ..deps import Ctx, Repo
from ..envelope import ok
from ..errors import ApiError, not_found
from ..repo import Approval, RecordVersion
from ..schemas import ApprovalRequest

router = APIRouter(prefix="/v1/approvals", tags=["approvals"])


@router.post("", status_code=201, summary="Onay ver veya düzeltme iste")
def decide(body: ApprovalRequest, request: Request, repo: Repo, ctx: Ctx):
    """in_review → approved (yalnız onaylayan, yazar olmayan) veya changes_requested (kontrolör/onaylayan).
    Karar değişmez iz olarak saklanır; kayıt yeni sürüm alır."""
    record = repo.get_record(ctx.tenant_id, body.record_id)
    if record is None:
        raise not_found("Kayıt")
    period = repo.get_period(ctx.tenant_id, record.period_id)
    org = repo.get_organization(ctx.tenant_id)
    assert period is not None and org is not None
    key = idempotency.get_key(request, required=False)
    payload = body.model_dump(mode="json")
    request_hash, previous = idempotency.lookup(repo, ctx, "POST /v1/approvals", key, payload)
    if previous is not None:
        return ok(request, previous.response, status_code=previous.status_code, meta={"idempotent_replay": True})

    current = record.current
    if body.expected_version != current.version:
        raise ApiError(409, "VERSION_CONFLICT", "Kayıt sürümü değişti; güncel sürümü inceleyin.",
                       details={"current_version": current.version, "expected_version": body.expected_version})

    self_approval = workflow.check_review_decision(ctx, record, period, org, body.decision, body.self_approval_reason)
    runs = [r for r in serializers.current_runs(repo, record) if r.status != "blocked"]
    run_id = runs[-1].id if runs else None
    if body.decision == "approve" and run_id is None and current.quantity_state != "not_applicable":
        raise ApiError(409, "CALCULATION_STALE", "Onay için güncel veri sürümüne ait hesap koşumu gerekli.")

    decision_state = workflow.APPROVED if body.decision == "approve" else workflow.CHANGES_REQUESTED
    new_version = current.version + 1
    repo.append_version(RecordVersion(
        tenant_id=ctx.tenant_id, record_id=record.id, version=new_version, data_version=current.data_version,
        state=decision_state, author_id=ctx.user_id, transition=body.decision, change_reason=body.comment,
        **current.data(),
    ))
    approval = Approval(
        id=str(uuid.uuid4()), tenant_id=ctx.tenant_id, record_id=record.id, record_version=new_version,
        run_id=run_id, decision="approved" if body.decision == "approve" else "changes_requested",
        decided_by=ctx.user_id, comment=body.comment, self_approval=self_approval,
        self_approval_reason=body.self_approval_reason if self_approval else None,
    )
    repo.add_approval(approval)
    record_event(repo, ctx, request, action=f"approval.{body.decision}", object_type="activity_record",
                 object_id=record.id, object_version=new_version, reason=body.comment,
                 payload={"approval_id": approval.id, "run_id": run_id, "self_approval": self_approval,
                          "self_approval_reason": approval.self_approval_reason})
    data = {"approval": serializers.approval(approval), "activity": serializers.activity(repo, record)}
    idempotency.store(repo, ctx, "POST /v1/approvals", key, request_hash, 201, data)
    return ok(request, data, status_code=201, headers={"ETag": f'"{new_version}"'})
