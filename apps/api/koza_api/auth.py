"""Kimlik ve tenant bağlamı (kural 3 ve 4, §04, §25, §27).

- Bearer token → Principal(user_id, memberships | None, jti, mfa_verified).
- Tenant bağlamı YALNIZ üyelik + `X-Tenant` başlığından türetilir; başlık bir üyelikle eşleşmezse 403.
  İstek gövdesindeki `tenant_id` yetki kanıtı değildir; şemalarda `extra="forbid"` olduğundan 422 ile reddedilir.
- İki token deposu:
  * `DevTokenStore` — `KOZA_DEV_TOKENS` (JSON) yalnız OIDC ayarlı DEĞİLKEN; üyelikler token içinde gelir.
  * `OidcTokenStore` — `KOZA_OIDC_ISSUER` ayarlıyken: JWT imzası JWKS ile doğrulanır (PyJWT), `sub` → app_user.oidc_subject
    (yedek: `email`), üyelik/rol her istekte DB `membership` tablosundan okunur (§04: yetki değişikliği açık oturumda etkili).
- Oturum iptali: `jti` iptal listesi depoda; iptal edilmiş token 401 SESSION_REVOKED (§25).
- MFA: `amr` içinde mfa/otp/hwk/sms/swk veya `acr` ∈ {mfa, aal2, aal3} → mfa_verified. Yönetici işlemleri
  `require_admin` ile MFA politikasını uygular (`KOZA_ADMIN_MFA`).

KOZA_DEV_TOKENS biçimi:
    {"<token>": {"user_id": "<uuid>", "memberships": [{"tenant_id": "<uuid>", "role": "data_entry"}], "mfa": false}}
"""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from typing import Any, Protocol

from fastapi import Request

from .errors import ApiError

ROLES = frozenset(
    {"admin", "data_entry", "data_owner", "reviewer", "approver", "viewer", "supplier", "content_editor"}
)

MFA_AMR = frozenset({"mfa", "otp", "hwk", "sms", "swk", "fido", "webauthn"})
MFA_ACR = frozenset({"mfa", "aal2", "aal3", "phrh", "phr"})


@dataclass(frozen=True)
class Membership:
    tenant_id: str
    role: str


@dataclass(frozen=True)
class Principal:
    user_id: str
    memberships: tuple[Membership, ...] | None  # None: üyelik depodan okunur (OIDC)
    jti: str
    mfa_verified: bool = False
    expires_at: str | None = None

    def roles_in(self, tenant_id: str) -> frozenset[str]:
        if self.memberships is None:
            return frozenset()
        return frozenset(m.role for m in self.memberships if m.tenant_id == tenant_id)


@dataclass(frozen=True)
class TenantContext:
    """Doğrulanmış kurum bağlamı. Her yetki kararı bunun üzerinden verilir."""

    tenant_id: str
    user_id: str
    roles: frozenset[str]
    jti: str = ""
    mfa_verified: bool = False
    admin_mfa_required: bool = False

    def has_any(self, roles: set[str] | frozenset[str]) -> bool:
        return bool(self.roles & roles)


class TokenStore(Protocol):
    kind: str

    def resolve(self, token: str) -> Principal | None: ...


def dev_jti(token: str) -> str:
    return "dev-" + hashlib.sha256(token.encode("utf-8")).hexdigest()[:32]


class DevTokenStore:
    """Geliştirme/test token deposu. Üretimde yerine OIDC doğrulaması gelir (§25)."""

    kind = "dev"

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
            mapping[token] = Principal(user_id=str(spec["user_id"]), memberships=tuple(memberships),
                                       jti=dev_jti(token), mfa_verified=bool(spec.get("mfa", False)))
        return cls(mapping)

    @classmethod
    def from_env(cls, env: dict[str, str] | None = None) -> "DevTokenStore":
        env = os.environ if env is None else env
        return cls.from_json(env.get("KOZA_DEV_TOKENS", ""))

    def resolve(self, token: str) -> Principal | None:
        return self._mapping.get(token)


class OidcTokenStore:
    """OIDC/JWT doğrulaması (PyJWT). Anahtarlar JWKS uç noktasından (`PyJWKClient`, önbellekli) veya dosyadan okunur.

    Ortam: KOZA_OIDC_ISSUER (zorunlu), KOZA_OIDC_AUDIENCE (zorunlu), KOZA_OIDC_JWKS_URL (varsayılan
    <issuer>/.well-known/jwks.json), KOZA_OIDC_JWKS_FILE (çevrimdışı JWKS JSON; URL'ye üstün gelir),
    KOZA_OIDC_ALGORITHMS (varsayılan RS256,ES256).
    Kullanıcı eşlemesi `user_lookup(sub, email)` ile depodan yapılır; tanımsız kullanıcı 401 (davet akışı ayrı).
    """

    kind = "oidc"

    def __init__(self, issuer: str, audience: str, *, jwks_url: str | None = None, jwks_file: str | None = None,
                 algorithms: tuple[str, ...] = ("RS256", "ES256"), user_lookup=None) -> None:
        self.issuer = issuer.rstrip("/")
        self.audience = audience
        self.algorithms = algorithms
        self.user_lookup = user_lookup
        self._jwks_file = jwks_file
        self._jwks_url = jwks_url or f"{self.issuer}/.well-known/jwks.json"
        self._client = None

    @classmethod
    def from_env(cls, user_lookup, env: dict[str, str] | None = None) -> "OidcTokenStore":
        env = os.environ if env is None else env
        issuer = env.get("KOZA_OIDC_ISSUER", "").strip()
        audience = env.get("KOZA_OIDC_AUDIENCE", "").strip()
        if not issuer or not audience:
            raise ValueError("KOZA_OIDC_ISSUER ve KOZA_OIDC_AUDIENCE birlikte ayarlanmalı.")
        algs = tuple(a.strip() for a in env.get("KOZA_OIDC_ALGORITHMS", "RS256,ES256").split(",") if a.strip())
        return cls(issuer, audience, jwks_url=env.get("KOZA_OIDC_JWKS_URL") or None,
                   jwks_file=env.get("KOZA_OIDC_JWKS_FILE") or None, algorithms=algs, user_lookup=user_lookup)

    def _signing_key(self, token: str):
        import jwt  # PyJWT

        if self._jwks_file:
            kid = jwt.get_unverified_header(token).get("kid")
            with open(self._jwks_file, encoding="utf-8") as fh:
                keys = json.load(fh).get("keys", [])
            for k in keys:
                if kid is None or k.get("kid") == kid:
                    return jwt.PyJWK(k).key
            return None
        if self._client is None:
            self._client = jwt.PyJWKClient(self._jwks_url, cache_keys=True)
        return self._client.get_signing_key_from_jwt(token).key

    def resolve(self, token: str) -> Principal | None:
        import jwt  # PyJWT

        try:
            key = self._signing_key(token)
            if key is None:
                return None
            claims: dict[str, Any] = jwt.decode(
                token, key, algorithms=list(self.algorithms), audience=self.audience, issuer=self.issuer,
                options={"require": ["exp", "iat", "sub"]},
            )
        except (jwt.PyJWTError, ValueError, OSError):
            return None
        sub = str(claims["sub"])
        email = claims.get("email")
        user = self.user_lookup(sub, email) if self.user_lookup else None
        if user is None:
            return None
        amr = {str(a).lower() for a in (claims.get("amr") or [])}
        acr = str(claims.get("acr") or "").lower()
        mfa = bool(amr & MFA_AMR) or acr in MFA_ACR
        jti = str(claims.get("jti") or ("oidc-" + hashlib.sha256(token.encode()).hexdigest()[:32]))
        from datetime import datetime, timezone

        exp = datetime.fromtimestamp(int(claims["exp"]), tz=timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
        return Principal(user_id=user.id, memberships=None, jti=jti, mfa_verified=mfa, expires_at=exp)


def get_principal(request: Request, repo) -> Principal:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise ApiError(401, "UNAUTHENTICATED", "Oturum bulunamadı; giriş yapın.")
    store: TokenStore = request.app.state.token_store
    principal = store.resolve(token.strip())
    if principal is None:
        raise ApiError(401, "UNAUTHENTICATED", "Oturum geçersiz veya süresi dolmuş.")
    if repo.is_token_revoked(principal.jti):
        raise ApiError(401, "SESSION_REVOKED", "Oturum sonlandırılmış; yeniden giriş yapın.")
    return principal


def get_tenant_context(request: Request, repo) -> TenantContext:
    """X-Tenant başlığı zorunludur ve principal'ın bir üyeliğiyle eşleşmelidir; aksi hâlde 403."""
    principal = get_principal(request, repo)
    tenant_id = request.headers.get("x-tenant", "").strip()
    if not tenant_id:
        raise ApiError(403, "TENANT_REQUIRED", "Aktif kurum seçilmedi (X-Tenant başlığı).")
    if principal.memberships is None:
        roles = repo.get_membership_roles(tenant_id, principal.user_id) if _is_uuid(tenant_id) else frozenset()
    else:
        roles = principal.roles_in(tenant_id)
    if not roles:
        raise ApiError(403, "TENANT_FORBIDDEN", "Bu kurumda yetkiniz yok.")
    policy = getattr(request.app.state, "security", None)
    return TenantContext(tenant_id=tenant_id, user_id=principal.user_id, roles=roles, jti=principal.jti,
                         mfa_verified=principal.mfa_verified,
                         admin_mfa_required=bool(policy and policy.admin_mfa_required))


def _is_uuid(value: str) -> bool:
    import uuid

    try:
        uuid.UUID(value)
        return True
    except (ValueError, AttributeError, TypeError):
        return False
