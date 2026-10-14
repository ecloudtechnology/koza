"""FastAPI bağımlılıkları.

`get_session`: istek başına tek depo oturumu. PostgresRepo'da bir bağlantı + bir işlem açar ve ilk sorgudan önce
`app.tenant_id`'yi X-Tenant başlığıyla ayarlar (RLS). Başlık doğrulanmadan hiçbir satır istemciye dönmez:
`_ctx` aynı oturumda üyeliği kontrol eder, eşleşme yoksa 403 ve işlem geri alınır. Yol işlevi başarıyla dönerse
commit, istisnada rollback (yanıt gönderilmeden önce).
"""

from __future__ import annotations

from typing import Annotated, Iterator

from fastapi import Depends, Request

from .audit import record_event
from .auth import TenantContext, _is_uuid, get_tenant_context
from .repo import Repository


def get_session(request: Request) -> Iterator[Repository]:
    repo = request.app.state.repo
    opener = getattr(repo, "session", None)
    if opener is None:
        yield repo
        return
    tenant = request.headers.get("x-tenant", "").strip()
    with opener(tenant if _is_uuid(tenant) else None) as session:
        yield session


Session = Annotated[Repository, Depends(get_session)]


def _ctx(request: Request, session: Session) -> TenantContext:
    ctx = get_tenant_context(request, session)
    # §25: giriş kayda alınır — bir oturum (jti) kurumda ilk kez görüldüğünde bir kez
    if ctx.jti and session.mark_session_seen(ctx.tenant_id, ctx.jti, ctx.user_id):
        record_event(session, ctx, request, action="session.login", object_type="session", object_id=None,
                     payload={"mfa_verified": ctx.mfa_verified, "roles": sorted(ctx.roles)})
    return ctx


Ctx = Annotated[TenantContext, Depends(_ctx)]


def get_repo(session: Session, ctx: Ctx) -> Repository:
    """Depo yalnız doğrulanmış bağlamla verilir (yetki önce, veri sonra)."""
    return session


Repo = Annotated[Repository, Depends(get_repo)]
