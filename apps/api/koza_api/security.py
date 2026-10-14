"""§25 güvenlik yardımcıları: hız sınırı (token kovası), güvenlik politikası, CSV formül temizliği."""

from __future__ import annotations

import hashlib
import os
import threading
import time
from dataclasses import dataclass


@dataclass(frozen=True)
class SecurityPolicy:
    admin_mfa_required: bool
    rate_limit_rps: float
    rate_limit_burst: int
    evidence_max_bytes: int
    evidence_allowed_types: frozenset[str]
    signed_url_ttl: int
    signed_url_max_ttl: int

    @classmethod
    def from_env(cls, env: dict[str, str] | None = None, *, oidc_enabled: bool = False) -> "SecurityPolicy":
        env = os.environ if env is None else env
        mfa_raw = env.get("KOZA_ADMIN_MFA", "").strip().lower()
        if mfa_raw in ("required", "true", "1"):
            mfa = True
        elif mfa_raw in ("off", "false", "0"):
            mfa = False
        else:
            mfa = oidc_enabled  # OIDC varken varsayılan zorunlu; dev tokenlarda kapalı
        allowed = env.get("KOZA_EVIDENCE_ALLOWED_TYPES", "").strip()
        return cls(
            admin_mfa_required=mfa,
            rate_limit_rps=float(env.get("KOZA_RATE_LIMIT_RPS", "20")),
            rate_limit_burst=int(env.get("KOZA_RATE_LIMIT_BURST", "60")),
            evidence_max_bytes=int(env.get("KOZA_EVIDENCE_MAX_BYTES", str(25 * 1024 * 1024))),
            evidence_allowed_types=frozenset(t.strip() for t in allowed.split(",") if t.strip()) if allowed else DEFAULT_EVIDENCE_TYPES,
            signed_url_ttl=int(env.get("KOZA_SIGNED_URL_TTL", "300")),
            signed_url_max_ttl=int(env.get("KOZA_SIGNED_URL_MAX_TTL", "900")),
        )


# Makro/aktif içerik taşıyan türler (xlsm, docm, html, js, exe...) listede yoktur (§25).
DEFAULT_EVIDENCE_TYPES = frozenset({
    "application/pdf",
    "image/png",
    "image/jpeg",
    "text/csv",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
})

BLOCKED_EXTENSIONS = frozenset({
    ".xlsm", ".xltm", ".docm", ".dotm", ".pptm", ".exe", ".dll", ".js", ".vbs", ".ps1", ".bat", ".cmd", ".sh",
    ".html", ".htm", ".svg", ".jar", ".msi", ".scr", ".com",
})


class TokenBucketLimiter:
    """Asıl başına token kovası. Anahtar: Authorization başlığının karması (kimlik çözülmeden) ya da istemci adresi."""

    def __init__(self, rps: float, burst: int) -> None:
        self.rps = rps
        self.burst = burst
        self._buckets: dict[str, tuple[float, float]] = {}
        self._lock = threading.Lock()

    @property
    def enabled(self) -> bool:
        return self.rps > 0 and self.burst > 0

    @staticmethod
    def key_for(authorization: str | None, client_host: str | None) -> str:
        if authorization:
            return "p:" + hashlib.sha256(authorization.encode("utf-8")).hexdigest()[:32]
        return "ip:" + (client_host or "unknown")

    def acquire(self, key: str, now: float | None = None) -> tuple[bool, float]:
        """Döner: (izin, yeniden deneme saniyesi)."""
        if not self.enabled:
            return True, 0.0
        now = time.monotonic() if now is None else now
        with self._lock:
            tokens, last = self._buckets.get(key, (float(self.burst), now))
            tokens = min(float(self.burst), tokens + (now - last) * self.rps)
            if tokens >= 1.0:
                self._buckets[key] = (tokens - 1.0, now)
                return True, 0.0
            self._buckets[key] = (tokens, now)
            return False, (1.0 - tokens) / self.rps


_FORMULA_PREFIX = ("=", "+", "-", "@", "\t", "\r")


def csv_safe(value: object) -> str:
    """CSV formül enjeksiyonu önleme (§25): hücre `= + - @ \\t \\r` ile başlıyorsa tek tırnakla etkisizleştirilir.
    Sayısal ondalık dizeler (ör. "-5" olamaz; miktar negatif kabul edilmez) dışında tüm metin alanlarına uygulanır."""
    if value is None:
        return ""
    text = str(value)
    if text.startswith(_FORMULA_PREFIX):
        return "'" + text
    return text
