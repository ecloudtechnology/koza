"""Denetim izi yazıcı (§25). Yalnız ekler; API'de silme/güncelleme ucu yoktur."""

from __future__ import annotations

from typing import Any

from fastapi import Request

from .auth import TenantContext
from .envelope import request_id_of
from .repo import AuditEvent, Repository


def record_event(
    repo: Repository,
    ctx: TenantContext,
    request: Request,
    *,
    action: str,
    object_type: str,
    object_id: str | None,
    object_version: int | None = None,
    reason: str | None = None,
    payload: dict[str, Any] | None = None,
) -> AuditEvent:
    """payload'a sır, tam kişisel içerik veya belge metni yazılmaz (§25)."""
    return repo.append_audit(
        AuditEvent(
            id=0,
            tenant_id=ctx.tenant_id,
            actor_id=ctx.user_id,
            action=action,
            object_type=object_type,
            object_id=object_id,
            object_version=object_version,
            reason=reason,
            request_id=request_id_of(request),
            payload=payload or {},
        )
    )


def serialize(event: AuditEvent) -> dict[str, Any]:
    return {
        "id": event.id,
        "actor_id": event.actor_id,
        "action": event.action,
        "object_type": event.object_type,
        "object_id": event.object_id,
        "object_version": event.object_version,
        "reason": event.reason,
        "request_id": event.request_id,
        "payload": event.payload,
        "occurred_at": event.occurred_at,
    }
