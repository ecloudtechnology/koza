"""Uygulama fabrikası. `uvicorn koza_api.main:app`.

Ortamdan seçilenler (başlangıçta tek satır log yazılır):
- Depo:        KOZA_DATABASE_URL ayarlıysa PostgresRepo, değilse InMemoryRepo (kalıcı değil).
- Kimlik:      KOZA_OIDC_ISSUER ayarlıysa OIDC/JWT, değilse KOZA_DEV_TOKENS (yalnız geliştirme).
- Dosya:       KOZA_OBJECT_STORE_DIR (yerel nesne deposu) + KOZA_SIGNING_SECRET (imzalı bağlantı) + KOZA_SCANNER.
- Güvenlik:    KOZA_RATE_LIMIT_RPS/BURST, KOZA_ADMIN_MFA, KOZA_EVIDENCE_MAX_BYTES, KOZA_WEBHOOK_SECRETS.
"""

from __future__ import annotations

import logging
import os
import uuid
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import API_VERSION, scanner as scanner_mod, webhooks
from .auth import DevTokenStore, OidcTokenStore, TokenStore
from .errors import ApiError
from .objectstore import LocalObjectStore, ObjectStore, UrlSigner
from .repo import InMemoryRepo, Repository
from .routers import ALL
from .security import SecurityPolicy, TokenBucketLimiter

log = logging.getLogger("koza_api")


def _rid(request: Request) -> str:
    return getattr(request.state, "request_id", "")


def repo_from_env(env: dict[str, str] | None = None) -> Repository:
    env = os.environ if env is None else env
    dsn = env.get("KOZA_DATABASE_URL", "").strip()
    if dsn:
        from .repo_postgres import PostgresRepo

        return PostgresRepo(dsn, inspect_dsn=env.get("KOZA_INSPECT_DATABASE_URL") or None)
    return InMemoryRepo()


def token_store_from_env(repo: Repository, env: dict[str, str] | None = None) -> TokenStore:
    env = os.environ if env is None else env
    if env.get("KOZA_OIDC_ISSUER", "").strip():
        def lookup(sub: str, email: str | None):
            user = repo.get_user_by_subject(sub)
            if user is None and email:
                user = repo.get_user_by_email(email)
            return None if user is None or user.disabled_at else user

        return OidcTokenStore.from_env(lookup, env)
    if env.get("KOZA_DEV_TOKENS", "").strip():
        log.warning("KOZA_DEV_TOKENS etkin: geliştirme kimlikleri. Üretimde KOZA_OIDC_ISSUER ayarlayın.")
    return DevTokenStore.from_env(env)


def create_app(
    repo: Repository | None = None,
    token_store: TokenStore | None = None,
    *,
    security: SecurityPolicy | None = None,
    object_store: ObjectStore | None = None,
    signer: UrlSigner | None = None,
    scanner: Any = None,
    webhook_secrets: dict[str, str] | None = None,
    env: dict[str, str] | None = None,
) -> FastAPI:
    env = os.environ if env is None else env
    if not logging.getLogger().handlers:  # uvicorn kök logger'a işleyici takmaz; başlangıç satırı görünür olsun
        logging.basicConfig(level=env.get("KOZA_LOG_LEVEL", "INFO"), format="%(levelname)s %(name)s: %(message)s")
    app = FastAPI(
        title="Koza API",
        version=API_VERSION,
        description=(
            "Koza iş API'si — Dilim 1. Zarf: {data, meta, request_id}; hata: {code, message, field_errors, "
            "retryable, request_id}. Kurum bağlamı X-Tenant başlığı + üyelikten doğrulanır; gövdedeki tenant_id reddedilir."
        ),
    )
    app.state.repo = repo if repo is not None else repo_from_env(env)
    app.state.token_store = token_store if token_store is not None else token_store_from_env(app.state.repo, env)
    oidc = getattr(app.state.token_store, "kind", "") == "oidc"
    app.state.security = security if security is not None else SecurityPolicy.from_env(env, oidc_enabled=oidc)
    if object_store is None and env.get("KOZA_OBJECT_STORE_DIR", "").strip():
        object_store = LocalObjectStore(env["KOZA_OBJECT_STORE_DIR"])
    app.state.object_store = object_store
    app.state.signer = signer if signer is not None else UrlSigner.from_env(env)
    app.state.scanner = scanner if scanner is not None else scanner_mod.from_env(env)
    app.state.webhook_secrets = webhook_secrets if webhook_secrets is not None else webhooks.secrets_from_env(env)
    app.state.limiter = TokenBucketLimiter(app.state.security.rate_limit_rps, app.state.security.rate_limit_burst)

    log.info(
        "koza_api %s: depo=%s kimlik=%s nesne_deposu=%s tarayici=%s imza=%s admin_mfa=%s hiz_siniri=%s/%s",
        API_VERSION, getattr(app.state.repo, "kind", "memory"), getattr(app.state.token_store, "kind", "custom"),
        getattr(object_store, "kind", "yok"), getattr(app.state.scanner, "kind", "custom"),
        "var" if app.state.signer else "yok", app.state.security.admin_mfa_required,
        app.state.security.rate_limit_rps, app.state.security.rate_limit_burst,
    )

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        incoming = request.headers.get("x-request-id", "").strip()
        request.state.request_id = incoming[:64] if incoming else str(uuid.uuid4())
        limiter: TokenBucketLimiter = request.app.state.limiter
        if limiter.enabled and request.url.path.startswith("/v1"):
            key = limiter.key_for(request.headers.get("authorization"), request.client.host if request.client else None)
            allowed, retry_after = limiter.acquire(key)
            if not allowed:
                body = ApiError(429, "RATE_LIMITED", "İstek sınırı aşıldı; kısa süre sonra yeniden deneyin.",
                                retryable=True, details={"retry_after_seconds": round(retry_after, 2)}).to_body(request.state.request_id)
                resp = JSONResponse(body, status_code=429, headers={"Retry-After": str(max(1, int(retry_after + 0.999)))})
                resp.headers["X-Request-Id"] = request.state.request_id
                return resp
        response = await call_next(request)
        response.headers["X-Request-Id"] = request.state.request_id
        return response

    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError):
        return JSONResponse(exc.to_body(_rid(request)), status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError):
        field_errors = []
        for err in exc.errors():
            loc = [str(p) for p in err.get("loc", []) if p != "body"]
            field_errors.append({"field": ".".join(loc) or "body", "message": err.get("msg", "")})
        body = ApiError(422, "VALIDATION_ERROR", "Alan hatası; alanları düzeltip yeniden deneyin.",
                        field_errors=field_errors).to_body(_rid(request))
        return JSONResponse(body, status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def http_handler(request: Request, exc: StarletteHTTPException):
        code = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED", 413: "PAYLOAD_TOO_LARGE"}.get(exc.status_code, "HTTP_ERROR")
        message = {404: "Kaynak bulunamadı.", 405: "Yöntem desteklenmiyor.", 413: "İstek gövdesi çok büyük."}.get(exc.status_code, str(exc.detail))
        return JSONResponse(ApiError(exc.status_code, code, message).to_body(_rid(request)), status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception):
        log.exception("beklenmeyen hata request_id=%s", _rid(request))
        body = ApiError(500, "INTERNAL_ERROR", "Beklenmeyen hata; yeniden deneyin.", retryable=True).to_body(_rid(request))
        return JSONResponse(body, status_code=500)

    @app.get("/healthz", tags=["ops"], summary="Sağlık")
    def healthz():
        return {"status": "ok", "version": API_VERSION, "repo": getattr(app.state.repo, "kind", "memory")}

    for router in ALL:
        app.include_router(router)
    return app


app = create_app()
