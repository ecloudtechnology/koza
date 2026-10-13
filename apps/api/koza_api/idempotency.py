"""Idempotency anahtarı (§27 kabul koşulu).

Aynı anahtar + aynı gövde → saklanan yanıt aynen döner (ikinci kayıt yaratılmaz).
Aynı anahtar + farklı gövde → 409 IDEMPOTENCY_MISMATCH.
Anahtar kurum + kullanıcı + uç bazında kapsamlıdır.
"""

from __future__ import annotations

from typing import Any

from fastapi import Request

from .auth import TenantContext
from .calc import canonical_json, sha256_hex
from .errors import ApiError
from .repo import IdempotencyEntry, Repository


def get_key(request: Request, *, required: bool) -> str | None:
    key = request.headers.get("idempotency-key", "").strip()
    if not key:
        if required:
            raise ApiError(
                400,
                "IDEMPOTENCY_KEY_REQUIRED",
                "Idempotency-Key başlığı zorunludur.",
                field_errors=[{"field": "Idempotency-Key", "message": "Başlık eksik."}],
            )
        return None
    if len(key) > 200:
        raise ApiError(400, "IDEMPOTENCY_KEY_INVALID", "Idempotency-Key çok uzun.")
    return key


def lookup(repo: Repository, ctx: TenantContext, endpoint: str, key: str | None, body: Any) -> tuple[str, IdempotencyEntry | None]:
    """Döner: (gövde karması, varsa önceki yanıt). Uyuşmazlıkta 409."""
    request_hash = sha256_hex(canonical_json(body))
    if key is None:
        return request_hash, None
    entry = repo.get_idempotency(ctx.tenant_id, ctx.user_id, endpoint, key)
    if entry is None:
        return request_hash, None
    if entry.request_hash != request_hash:
        raise ApiError(
            409,
            "IDEMPOTENCY_MISMATCH",
            "Aynı Idempotency-Key ile farklı içerik gönderildi.",
            details={"endpoint": endpoint},
        )
    return request_hash, entry


def store(repo: Repository, ctx: TenantContext, endpoint: str, key: str | None, request_hash: str, status_code: int, data: Any) -> None:
    if key is None:
        return
    repo.put_idempotency(ctx.tenant_id, ctx.user_id, endpoint, key, IdempotencyEntry(request_hash, status_code, data))
