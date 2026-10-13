"""Hesap motoru köprüsü. Sayısal sonucu yalnız `koza_calc` üretir (kural 1).

`koza_calc` tembel içe aktarılır; paket kurulu değilse 503 CALC_ENGINE_UNAVAILABLE döner.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any, Callable

from .errors import ApiError
from .repo import RecordVersion


def canonical_json(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def load_engine() -> tuple[Callable[[dict[str, Any]], dict[str, Any]], str]:
    try:
        from koza_calc import ENGINE_VERSION, calculate  # type: ignore[import-not-found]
    except ImportError as exc:  # pragma: no cover - ortam bağımlı
        raise ApiError(
            503,
            "CALC_ENGINE_UNAVAILABLE",
            "Hesap motoru kurulu değil; `pip install -e packages/calc-engine`.",
            retryable=True,
        ) from exc
    return calculate, str(ENGINE_VERSION)


def build_engine_request(
    *,
    record_id: str,
    data_version: int,
    version: RecordVersion,
    factors: list[dict[str, Any]],
    method: dict[str, Any],
    calorific_value: dict[str, Any] | None,
    basis_conversion: dict[str, Any] | None,
    reference_conditions: dict[str, Any] | None,
) -> dict[str, Any]:
    """CONTRACT.md istek biçimi. Miktar ondalık dize olarak geçer; sayıya çevrilmez."""
    return {
        "activity": {
            "id": record_id,
            "version": data_version,
            "source_type": version.source_type,
            "fuel": version.fuel,
            "quantity": version.quantity,
            "unit": version.unit,
            "heating_value_basis": version.heating_value_basis,
            "reference_conditions": reference_conditions,
            "calorific_value": calorific_value,
            "basis_conversion": basis_conversion,
            "data_quality": version.data_quality,
            "period": {"start": version.activity_start, "end": version.activity_end},
        },
        "factors": factors,
        "method": method,
    }


def run_engine(request: dict[str, Any]) -> tuple[dict[str, Any], str]:
    calculate, engine_version = load_engine()
    result = calculate(request)
    if not isinstance(result, dict) or "status" not in result:
        raise ApiError(502, "CALC_ENGINE_BAD_RESPONSE", "Hesap motoru beklenmeyen yanıt verdi.")
    result.setdefault("engine_version", engine_version)
    result.setdefault("inputs_hash", "sha256:" + sha256_hex(canonical_json(request)))
    return result, engine_version
