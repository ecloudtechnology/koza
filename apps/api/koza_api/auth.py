"""Kimlik ve tenant bağlamı (kural 3 ve 4, §04, §27).

- Bearer token → Principal(user_id, memberships).
- Tenant bağlamı YALNIZ Principal üyeliği + `X-Tenant` başlığından türetilir; başlık bir üyelikle
  eşleşmezse 403. İstek gövdesindeki `tenant_id` yetki kanıtı değildir; şemalarda `extra="forbid"`
  olduğundan gövdede gelirse 422 ile reddedilir.
- Geliştirme tokenları `KOZA_DEV_TOKENS` ortam değişkeninden (JSON) okunur; koda sır gömülmez.

KOZA_DEV_TOKENS biçimi:
    {"<token>": {"user_id": "<uuid>", "memberships": [{"tenant_id": "<uuid>", "role": "data_entry"}]}}
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Protocol

from fastapi import Request

from .errors import ApiError

ROLES = frozenset(
    {"admin", "data_entry", "data_owner", "reviewer", "approver", "viewer", "supplier", "content_editor"}
)


@dataclass(frozen=True)
class Membership:
    tenant_id: str
    role: str


@dataclass(frozen=True)
class Principal:
    user_id: str
    memberships: tuple[Membership, ...]

    def roles_in(self, tenant_id: str) -> frozenset[str]:
        return frozenset(m.role for m in self.memberships if m.tenant_id == tenant_id)


@dataclass(frozen=True)
class TenantContext:
    """Doğrulanmış kurum bağlamı. Her yetki kararı bunun üzerinden verilir."""

    tenant_id: str
    user_id: str
    roles: frozenset[str]

    def has_any(self, roles: set[str] | frozenset[str]) -> bool:
        return bool(self.roles & roles)


class TokenStore(Protocol):
    def resolve(self, token: str) -> Principal | None: ...


class DevTokenStore:
    """Geliştirme/test token deposu. Üretimde yerine oturum/OIDC doğrulaması gelir (§25)."""

    def __init__(self, mapping: dict[str, Principal]) -> None:
        self._mapping = dict(mapping)

    @classmethod
    def from_json(cls, raw: str) -> "DevTokenStore":
        parsed = json.loads(raw) if raw else {}
        mapping: dict[str, Principal] = {}
        for token, spec in parsed.items():
            memberships = []
            for m in spec.get("memberships", []):
                role = m["role"]
                if role not in ROLES:
                    raise ValueError(f"Bilinmeyen rol: {role}")
                memberships.append(Membership(tenant_id=str(m["tenant_id"]), role=role))
            mapping[token] = Principal(user_id=str(spec["user_id"]), memberships=tuple(memberships))
        return cls(mapping)

    @classmethod
    def from_env(cls, env: dict[str, str] | None = None) -> "DevTokenStore":
        env = os.environ if env is None else env
        return cls.from_json(env.get("KOZA_DEV_TOKENS", ""))

    def resolve(self, token: str) -> Principal | None:
        return self._mapping.get(token)


def get_principal(request: Request) -> Principal:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise ApiError(401, "UNAUTHENTICATED", "Oturum bulunamadı; giriş yapın.")
    store: TokenStore = request.app.state.token_store
    principal = store.resolve(token.strip())
    if principal is None:
        raise ApiError(401, "UNAUTHENTICATED", "Oturum geçersiz veya süresi dolmuş.")
    return principal


def get_tenant_context(request: Request) -> TenantContext:
    """X-Tenant başlığı zorunludur ve principal'ın bir üyeliğiyle eşleşmelidir; aksi hâlde 403."""
    principal = get_principal(request)
    tenant_id = request.headers.get("x-tenant", "").strip()
    if not tenant_id:
        raise ApiError(403, "TENANT_REQUIRED", "Aktif kurum seçilmedi (X-Tenant başlığı).")
    roles = principal.roles_in(tenant_id)
    if not roles:
        raise ApiError(403, "TENANT_FORBIDDEN", "Bu kurumda yetkiniz yok.")
    return TenantContext(tenant_id=tenant_id, user_id=principal.user_id, roles=roles)
