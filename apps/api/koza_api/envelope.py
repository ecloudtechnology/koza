"""Başarılı yanıt zarfı (§27): {data, meta, request_id}."""

from __future__ import annotations

from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse


def request_id_of(request: Request) -> str:
    return getattr(request.state, "request_id", "")


def ok(
    request: Request,
    data: Any,
    *,
    status_code: int = 200,
    meta: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    body = {"data": data, "meta": meta or {}, "request_id": request_id_of(request)}
    return JSONResponse(body, status_code=status_code, headers=headers)
