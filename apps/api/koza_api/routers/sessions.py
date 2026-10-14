"""Oturum (§25, §04): oturum bilgisi ve jti iptali. İptal edilen token bir sonraki istekte 401 SESSION_REVOKED alır."""

from __future__ import annotations

from fastapi import APIRouter, Request

from .. import workflow
from ..audit import record_event
from ..deps import Ctx, Repo
from ..envelope import ok
from ..errors import forbidden
from ..repo import RevokedToken
from ..schemas import SessionRevokeRequest

router = APIRouter(prefix="/v1/sessions", tags=["sessions"])


@router.get("/me", summary="Oturum bilgisi")
def me(request: Request, repo: Repo, ctx: Ctx):
    return ok(request, {"user_id": ctx.user_id, "tenant_id": ctx.tenant_id, "roles": sorted(ctx.roles), "jti": ctx.jti,
                        "mfa_verified": ctx.mfa_verified, "admin_mfa_required": ctx.admin_mfa_required,
                        "token_store": getattr(request.app.state.token_store, "kind", "custom")})


@router.post("/revoke", summary="Oturumu sonlandır (jti iptal listesi)")
def revoke(body: SessionRevokeRequest, request: Request, repo: Repo, ctx: Ctx):
    """Kendi oturumu herkes; başka bir jti yalnız admin (ör. ayrılan çalışanın açık oturumu)."""
    jti = body.jti or ctx.jti
    if jti != ctx.jti:
        if not ctx.has_any(workflow.PERIOD_MANAGE_ROLES):
            raise forbidden("Başka oturumu yalnız kurum yöneticisi sonlandırabilir.")
        workflow.require_admin(ctx)
    repo.revoke_token(RevokedToken(jti=jti, user_id=ctx.user_id if jti == ctx.jti else None, reason=body.reason, expires_at=None))
    record_event(repo, ctx, request, action="session.revoke", object_type="session", object_id=None, reason=body.reason,
                 payload={"jti": jti, "own_session": jti == ctx.jti})
    return ok(request, {"revoked": True, "jti": jti})
