"""Uygulama fabrikası. `uvicorn koza_api.main:app`."""

from __future__ import annotations

import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import API_VERSION
from .auth import DevTokenStore, TokenStore
from .errors import ApiError
from .repo import InMemoryRepo, Repository
from .routers import ALL


def _rid(request: Request) -> str:
    return getattr(request.state, "request_id", "")


def create_app(repo: Repository | None = None, token_store: TokenStore | None = None) -> FastAPI:
    app = FastAPI(
        title="Koza API",
        version=API_VERSION,
        description=(
            "Koza iş API'si — Dilim 0. Zarf: {data, meta, request_id}; hata: {code, message, field_errors, "
            "retryable, request_id}. Kurum bağlamı X-Tenant başlığı + üyelikten doğrulanır."
        ),
    )
    app.state.repo = repo if repo is not None else InMemoryRepo()
    app.state.token_store = token_store if token_store is not None else DevTokenStore.from_env()

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        incoming = request.headers.get("x-request-id", "").strip()
        request.state.request_id = incoming[:64] if incoming else str(uuid.uuid4())
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
        code = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}.get(exc.status_code, "HTTP_ERROR")
        message = {404: "Kaynak bulunamadı.", 405: "Yöntem desteklenmiyor."}.get(exc.status_code, str(exc.detail))
        return JSONResponse(ApiError(exc.status_code, code, message).to_body(_rid(request)), status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception):
        body = ApiError(500, "INTERNAL_ERROR", "Beklenmeyen hata; yeniden deneyin.", retryable=True).to_body(_rid(request))
        return JSONResponse(body, status_code=500)

    @app.get("/healthz", tags=["ops"], summary="Sağlık")
    def healthz():
        return {"status": "ok", "version": API_VERSION}

    for router in ALL:
        app.include_router(router)
    return app


app = create_app()
