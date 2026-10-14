"""Nesne deposu uyarlayıcısı ve kısa ömürlü imzalı bağlantılar (§25).

`LocalObjectStore(KOZA_OBJECT_STORE_DIR)`: dosyalar `<kök>/<tenant_id>/<evidence_id>` altında tutulur (tenant ayrımı
dizin düzeyinde; kural 3). S3 uyumlu depo aynı `ObjectStore` protokolünü uygulayarak takılır.

İmzalı bağlantı: HMAC-SHA256(`KOZA_SIGNING_SECRET`, "<tenant_id>:<evidence_id>:<exp>") ; `exp` Unix saniyesi.
Sır ayarlı değilse bağlantı üretimi 503 SIGNING_SECRET_MISSING ile reddedilir — imzasız bağlantı asla üretilmez.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import shutil
import time
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Protocol


class ObjectStore(Protocol):
    kind: str

    def put(self, tenant_id: str, object_id: str, stream: BinaryIO, *, max_bytes: int) -> tuple[str, str, int]:
        """Döner: (object_key, sha256, size_bytes). max_bytes aşılırsa `TooLarge` fırlatır; hiçbir şey saklanmaz."""
        ...

    def open(self, object_key: str) -> BinaryIO: ...
    def delete(self, object_key: str) -> None: ...
    def path_for(self, object_key: str) -> Path | None: ...


class TooLarge(Exception):
    pass


class LocalObjectStore:
    kind = "local"

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, object_key: str) -> Path:
        p = (self.root / object_key).resolve()
        if self.root not in p.parents:
            raise ValueError("Nesne anahtarı kök dışına çıkıyor")
        return p

    def put(self, tenant_id: str, object_id: str, stream: BinaryIO, *, max_bytes: int) -> tuple[str, str, int]:
        key = f"{tenant_id}/{object_id}"
        target = self._path(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        tmp = target.with_suffix(".part")
        digest = hashlib.sha256()
        size = 0
        try:
            with open(tmp, "wb") as out:
                while True:
                    chunk = stream.read(1024 * 1024)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > max_bytes:
                        raise TooLarge(size)
                    digest.update(chunk)
                    out.write(chunk)
            os.replace(tmp, target)
        except BaseException:
            tmp.unlink(missing_ok=True)
            raise
        return key, digest.hexdigest(), size

    def open(self, object_key: str) -> BinaryIO:
        return open(self._path(object_key), "rb")

    def delete(self, object_key: str) -> None:
        self._path(object_key).unlink(missing_ok=True)

    def path_for(self, object_key: str) -> Path | None:
        p = self._path(object_key)
        return p if p.exists() else None

    def wipe_for_tests(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)
        self.root.mkdir(parents=True, exist_ok=True)


@dataclass(frozen=True)
class UrlSigner:
    secret: bytes

    @classmethod
    def from_env(cls, env: dict[str, str] | None = None) -> "UrlSigner | None":
        env = os.environ if env is None else env
        raw = env.get("KOZA_SIGNING_SECRET", "")
        if not raw or len(raw) < 16:
            return None
        return cls(raw.encode("utf-8"))

    def _mac(self, tenant_id: str, object_id: str, exp: int) -> str:
        msg = f"{tenant_id}:{object_id}:{exp}".encode("utf-8")
        return hmac.new(self.secret, msg, hashlib.sha256).hexdigest()

    def sign(self, tenant_id: str, object_id: str, ttl: int, now: float | None = None) -> tuple[int, str]:
        exp = int((time.time() if now is None else now) + ttl)
        return exp, self._mac(tenant_id, object_id, exp)

    def verify(self, tenant_id: str, object_id: str, exp: int, sig: str, now: float | None = None) -> bool:
        if exp < (time.time() if now is None else now):
            return False
        return hmac.compare_digest(self._mac(tenant_id, object_id, exp), sig)
