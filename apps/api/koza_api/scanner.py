"""Zararlı içerik tarama kancası (§25). Tarama tamamlanmadan kanıt kullanılmaz.

`KOZA_SCANNER`:
- ayarsız        → `PendingScanner`: dosya `pending` kalır; harici tarayıcı/işçi sonucu yazana kadar indirilemez.
- `none`         → `NoScanner`: AÇIKÇA tarama yapılmadığı beyan edilir ve dosya `clean` işaretlenir (yalnız geliştirme/test).
- `command`      → `CommandScanner(KOZA_SCANNER_COMMAND)`: komut dosya yoluyla çalıştırılır; çıkış kodu 0 → clean,
                   1 → rejected (ör. `clamscan --no-summary`), diğer → pending (tarayıcı hatası dosyayı temiz saymaz).
"""

from __future__ import annotations

import os
import shlex
import subprocess
from pathlib import Path
from typing import Protocol


class Scanner(Protocol):
    kind: str

    def scan(self, path: Path, content_type: str | None) -> str: ...


class PendingScanner:
    kind = "pending"

    def scan(self, path: Path, content_type: str | None) -> str:
        return "pending"


class NoScanner:
    kind = "none"

    def scan(self, path: Path, content_type: str | None) -> str:
        return "clean"


class CommandScanner:
    kind = "command"

    def __init__(self, command: str, timeout: int = 120) -> None:
        if not command.strip():
            raise ValueError("KOZA_SCANNER=command için KOZA_SCANNER_COMMAND gerekli.")
        self.command = shlex.split(command)
        self.timeout = timeout

    def scan(self, path: Path, content_type: str | None) -> str:
        try:
            proc = subprocess.run([*self.command, str(path)], capture_output=True, timeout=self.timeout, check=False)
        except (OSError, subprocess.TimeoutExpired):
            return "pending"
        if proc.returncode == 0:
            return "clean"
        if proc.returncode == 1:
            return "rejected"
        return "pending"


def from_env(env: dict[str, str] | None = None) -> Scanner:
    env = os.environ if env is None else env
    mode = env.get("KOZA_SCANNER", "").strip().lower()
    if mode == "none":
        return NoScanner()
    if mode == "command":
        return CommandScanner(env.get("KOZA_SCANNER_COMMAND", ""), int(env.get("KOZA_SCANNER_TIMEOUT", "120")))
    if mode in ("", "pending"):
        return PendingScanner()
    raise ValueError(f"Bilinmeyen KOZA_SCANNER değeri: {mode}")
