"""OpenAPI şemasını `docs/api/openapi.yaml` dosyasına yazar.

Kullanım (depo kökünden):  python apps/api/scripts/export_openapi.py [çıktı_yolu]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from koza_api.auth import DevTokenStore
from koza_api.main import create_app
from koza_api.repo import InMemoryRepo


def _to_yaml(obj, indent: int = 0) -> str:
    """Küçük, bağımlılıksız YAML yazıcı (sözlük/liste/skaler)."""
    pad = "  " * indent
    if isinstance(obj, dict):
        if not obj:
            return "{}"
        lines = []
        for k, v in obj.items():
            key = json.dumps(k) if not str(k).replace("_", "a").replace("-", "a").replace("/", "a").replace("{", "a").replace("}", "a").isalnum() else str(k)
            if isinstance(v, (dict, list)) and v:
                lines.append(f"{pad}{key}:\n{_to_yaml(v, indent + 1)}")
            else:
                lines.append(f"{pad}{key}: {_to_yaml(v, indent + 1)}")
        return "\n".join(lines)
    if isinstance(obj, list):
        if not obj:
            return "[]"
        lines = []
        for item in obj:
            if isinstance(item, (dict, list)) and item:
                nested = _to_yaml(item, indent + 1)
                first, _, rest = nested.partition("\n")
                lines.append(f"{pad}- {first.lstrip()}" + (f"\n{rest}" if rest else ""))
            else:
                lines.append(f"{pad}- {_to_yaml(item, indent + 1)}")
        return "\n".join(lines)
    if obj is None:
        return "null"
    if isinstance(obj, bool):
        return "true" if obj else "false"
    if isinstance(obj, (int, float)):
        return json.dumps(obj)
    return json.dumps(obj, ensure_ascii=False)


def main() -> None:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[3] / "docs" / "api" / "openapi.yaml"
    app = create_app(repo=InMemoryRepo(), token_store=DevTokenStore({}))
    schema = app.openapi()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("# Üretilmiş dosya — elle düzenlemeyin. Kaynak: apps/api/scripts/export_openapi.py\n" + _to_yaml(schema) + "\n", encoding="utf-8")
    print(f"yazıldı: {out}")


if __name__ == "__main__":
    main()
