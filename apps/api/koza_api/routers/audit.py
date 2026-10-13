"""Denetim izi okuma. Yazma yalnız sistem içinden; silme/güncelleme ucu yoktur."""

from __future__ import annotations

from fastapi import APIRouter, Query, Request

from .. import workflow
from ..audit import serialize
from ..deps import Ctx, Repo
from ..envelope import ok

router = APIRouter(prefix="/v1/audit", tags=["audit"])


@router.get("", summary="Denetim izi (append-only)")
def list_audit(request: Request, repo: Repo, ctx: Ctx,
               object_id: str | None = Query(default=None), limit: int = Query(default=100, ge=1, le=1000)):
    workflow.require_roles(ctx, workflow.AUDIT_ROLES)
    events = repo.list_audit(ctx.tenant_id, object_id=object_id, limit=limit)
    return ok(request, [serialize(e) for e in events], meta={"count": len(events)})
