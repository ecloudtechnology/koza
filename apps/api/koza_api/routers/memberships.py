"""Üyelik ve rol yönetimi (§04; §25 rol değişimi kayda alınır). Yalnız kurum yöneticisi; MFA politikası uygulanır."""

from __future__ import annotations

from fastapi import APIRouter, Request

from .. import workflow
from ..audit import record_event
from ..deps import Ctx, Repo
from ..envelope import ok
from ..errors import ApiError
from ..schemas import MembershipChange

router = APIRouter(prefix="/v1/memberships", tags=["memberships"])


@router.get("", summary="Kurum üyelikleri")
def list_memberships(request: Request, repo: Repo, ctx: Ctx):
    workflow.require_roles(ctx, workflow.MEMBERSHIP_ROLES)
    return ok(request, repo.list_memberships(ctx.tenant_id))


@router.post("", summary="Rol ver / rolü geri al (admin + MFA)")
def change_membership(body: MembershipChange, request: Request, repo: Repo, ctx: Ctx):
    """OIDC modunda değişiklik açık oturumda hemen etkilidir (roller her istekte depodan okunur). Dev tokenlarda roller
    token içinde geldiğinden yalnız depo güncellenir; `meta.effective_for_dev_tokens=false`."""
    workflow.require_admin(ctx)
    if repo.get_user(body.user_id) is None:
        raise ApiError(422, "VALIDATION_ERROR", "Alan hatası.", field_errors=[{"field": "user_id", "message": "Kullanıcı tanımlı değil."}])
    if body.action == "grant":
        repo.add_membership(ctx.tenant_id, body.user_id, body.role, ctx.user_id)
        changed = True
    else:
        if body.user_id == ctx.user_id and body.role == workflow.ADMIN:
            raise ApiError(409, "LAST_ADMIN_PROTECTED", "Kendi yönetici rolünüzü geri alamazsınız.")
        changed = repo.revoke_membership(ctx.tenant_id, body.user_id, body.role)
    record_event(repo, ctx, request, action="membership.change", object_type="membership", object_id=body.user_id,
                 reason=body.reason, payload={"role": body.role, "action": body.action, "changed": changed})
    dev = getattr(request.app.state.token_store, "kind", "") == "dev"
    return ok(request, {"user_id": body.user_id, "roles": sorted(repo.get_membership_roles(ctx.tenant_id, body.user_id)), "changed": changed},
              meta={"effective_for_dev_tokens": not dev})
