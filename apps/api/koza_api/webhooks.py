"""Webhook imza doğrulaması (§27 entegrasyonlar).

İmza: `X-Koza-Signature: sha256=<hex>`; `hex = HMAC-SHA256(secret, "<timestamp>.<ham gövde>")`.
`X-Koza-Timestamp` Unix saniyesi; tolerans dışı (varsayılan 300 sn) istek yeniden oynatma sayılır ve reddedilir.
Sırlar `KOZA_WEBHOOK_SECRETS` (JSON: {"<source_system>": "<secret>"}) içinden okunur; sistem için sır yoksa 503.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import time


def compute_signature(secret: str, timestamp: str, body: bytes) -> str:
    msg = timestamp.encode("utf-8") + b"." + body
    return "sha256=" + hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def verify_signature(secret: str, timestamp: str, body: bytes, header: str, *, tolerance: int = 300,
                     now: float | None = None) -> tuple[bool, str]:
    """Döner: (geçerli mi, neden kodu). Nedenler: ok | timestamp_missing | timestamp_invalid | stale | signature_mismatch."""
    if not timestamp:
        return False, "timestamp_missing"
    try:
        ts = int(timestamp)
    except ValueError:
        return False, "timestamp_invalid"
    current = time.time() if now is None else now
    if abs(current - ts) > tolerance:
        return False, "stale"
    expected = compute_signature(secret, timestamp, body)
    if not header or not hmac.compare_digest(expected, header.strip()):
        return False, "signature_mismatch"
    return True, "ok"


def secrets_from_env(env: dict[str, str] | None = None) -> dict[str, str]:
    env = os.environ if env is None else env
    raw = env.get("KOZA_WEBHOOK_SECRETS", "").strip()
    if not raw:
        return {}
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError("KOZA_WEBHOOK_SECRETS bir JSON nesnesi olmalı.")
    return {str(k): str(v) for k, v in parsed.items()}
