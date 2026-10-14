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


SCOPE1_TYPES = ("stationary_combustion", "mobile_combustion", "process", "refrigerant")
SCOPE2_TYPES = ("purchased_electricity", "purchased_steam", "purchased_heat", "purchased_cooling")


def load_aggregate() -> tuple[Callable[[dict[str, Any]], dict[str, Any]], str]:
    """`koza_calc.aggregate` (motor 0.2, K-17). Yoksa 503 AGGREGATE_UNAVAILABLE: API toplam ÜRETMEZ (kural 1)."""
    try:
        import koza_calc  # type: ignore[import-not-found]
    except ImportError as exc:  # pragma: no cover - ortam bağımlı
        raise ApiError(503, "CALC_ENGINE_UNAVAILABLE", "Hesap motoru kurulu değil; `pip install -e packages/calc-engine`.",
                       retryable=True) from exc
    aggregate = getattr(koza_calc, "aggregate", None)
    if aggregate is None:
        raise ApiError(
            503, "AGGREGATE_UNAVAILABLE",
            "Toplama motor sürümü 0.2 gerektirir (koza_calc.aggregate yok); API kendi başına toplam üretmez.",
            retryable=True, details={"engine_version": str(getattr(koza_calc, "ENGINE_VERSION", "?"))},
        )
    return aggregate, str(getattr(koza_calc, "ENGINE_VERSION", "?"))


def classify_run(source_type: str, engine_request: dict[str, Any]) -> dict[str, Any]:
    """Toplama isteği için bağlam/kapsam/kategori (CONTRACT-v0.2 §7). Sayı üretmez; yalnız etiketler."""
    activity = engine_request.get("activity") or {}
    if source_type == "product_process":
        return {"context": "product", "scope": None, "category": None}
    if source_type in SCOPE1_TYPES:
        return {"context": "corporate", "scope": 1, "category": None}
    if source_type in SCOPE2_TYPES:
        return {"context": "corporate", "scope": 2, "category": None}
    if source_type == "scope3":
        cat = (activity.get("scope3") or {}).get("category")
        return {"context": "corporate", "scope": 3, "category": int(cat) if cat is not None else None}
    return {"context": "corporate", "scope": None, "category": None}
