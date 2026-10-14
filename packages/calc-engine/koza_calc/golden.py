"""Altın set koşucusu — `tests/golden/*.json`.

Hem pytest hem tarayıcı (Pyodide) kullanır. `expected` alanları alt küme
eşleşmesiyle karşılaştırılır: listelenen alan birebir eşit olmalı,
listelenmeyen alan kontrol edilmez. Listelerde uzunluk eşit olmalı ve her
öğe sırayla alt küme eşleşmesiyle karşılaştırılır. `block_codes` ve
`warning_codes` yanıttaki `blocks`/`warnings` listelerinden türetilir ve
sırasız karşılaştırılır.

Kayıt `request` taşıyorsa `calculate()`, `aggregate_request` taşıyorsa
`aggregate()` koşulur (0.2).
"""

from __future__ import annotations

import json
import os

from .aggregate import aggregate
from .engine import calculate

DERIVED_UNORDERED = ("block_codes", "warning_codes")


def _derived_view(result: dict) -> dict:
    view = dict(result)
    view["block_codes"] = [b["code"] for b in result.get("blocks", [])]
    view["warning_codes"] = [w["code"] for w in result.get("warnings", [])]
    return view


def _subset_diff(expected: object, actual: object, path: str, diffs: list[str]) -> None:
    if isinstance(expected, dict):
        if not isinstance(actual, dict):
            diffs.append(f"{path}: nesne bekleniyor, gelen {_show(actual)}")
            return
        for key, exp_value in expected.items():
            child = f"{path}.{key}" if path else key
            if key not in actual:
                diffs.append(f"{child}: alan yok (beklenen {_show(exp_value)})")
                continue
            if key in DERIVED_UNORDERED and isinstance(exp_value, list) and isinstance(actual[key], list):
                if sorted(exp_value) != sorted(actual[key]):
                    diffs.append(f"{child}: beklenen {_show(sorted(exp_value))}, gelen {_show(sorted(actual[key]))}")
                continue
            _subset_diff(exp_value, actual[key], child, diffs)
        return
    if isinstance(expected, list):
        if not isinstance(actual, list):
            diffs.append(f"{path}: liste bekleniyor, gelen {_show(actual)}")
            return
        if len(expected) != len(actual):
            diffs.append(f"{path}: liste uzunluğu beklenen {len(expected)}, gelen {len(actual)}")
            return
        for i, (exp_item, act_item) in enumerate(zip(expected, actual)):
            _subset_diff(exp_item, act_item, f"{path}[{i}]", diffs)
        return
    # Skaler: tür dahil birebir eşitlik (bool ile int karışmaz).
    if type(expected) is not type(actual) or expected != actual:
        diffs.append(f"{path}: beklenen {_show(expected)}, gelen {_show(actual)}")


def _show(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def run_fixture(fixture: dict) -> dict:
    """Ayrıştırılmış tek bir altın kaydı koşar; {"id","ok","diff"} döner."""
    fixture_id = fixture.get("id") if isinstance(fixture, dict) else None
    if not isinstance(fixture, dict) or "expected" not in fixture or not ("request" in fixture or "aggregate_request" in fixture):
        return {"id": fixture_id, "ok": False, "diff": ["kayıtta 'request' (veya 'aggregate_request') ve 'expected' alanları gerekli"]}
    if "aggregate_request" in fixture:
        result = aggregate(fixture["aggregate_request"])
    else:
        result = calculate(fixture["request"])
    diffs: list[str] = []
    _subset_diff(fixture["expected"], _derived_view(result), "", diffs)
    return {"id": fixture_id, "ok": not diffs, "diff": diffs}


def run_file(path_or_dict) -> dict:
    """Dosya yolu ya da ayrıştırılmış sözlük alır."""
    if isinstance(path_or_dict, dict):
        return run_fixture(path_or_dict)
    with open(path_or_dict, "r", encoding="utf-8") as handle:
        try:
            fixture = json.load(handle)
        except ValueError as exc:
            return {"id": os.path.basename(str(path_or_dict)), "ok": False, "diff": [f"JSON okunamadı: {exc}"]}
    result = run_fixture(fixture)
    if result["id"] is None:
        result["id"] = os.path.basename(str(path_or_dict))
    return result


def run_dir(directory) -> dict:
    """Dizindeki tüm *.json kayıtlarını ad sırasıyla koşar."""
    names = sorted(n for n in os.listdir(directory) if n.endswith(".json"))
    results = [run_file(os.path.join(directory, name)) for name in names]
    passed = sum(1 for r in results if r["ok"])
    return {"passed": passed, "failed": len(results) - passed, "results": results}


def run_fixtures(fixtures: list) -> dict:
    """Tarayıcı için: ayrıştırılmış kayıt listesini koşar (dosya sistemi gerekmez)."""
    results = [run_fixture(f) for f in fixtures]
    passed = sum(1 for r in results if r["ok"])
    return {"passed": passed, "failed": len(results) - passed, "results": results}
