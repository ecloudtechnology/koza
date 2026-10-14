"""Deterministik hesap motoru — giriş noktası ve kaynak türü dağıtımı.

`calculate(request)` kaynak türüne göre ilgili modüle dağıtır:

* `stationary_combustion`, `mobile_combustion`, `process` → bu modül (miktar × faktör)
* `refrigerant` → `refrigerant.py`
* `purchased_electricity|steam|heat|cooling` → `scope2.py`
* `scope3` → `scope3.py`
* `product_process` → `product.py`

Desteklenmeyen tür `UNSUPPORTED_SOURCE_TYPE` ile bloke olur (§30). Hiçbir
durumda istisna fırlatmaz; sayısal hatalar bloğa dönüşür.
"""

from __future__ import annotations

from decimal import DivisionByZero, InvalidOperation, Overflow, localcontext

from . import core as C
from . import product, refrigerant, scope2, scope3
from . import units as U
from .core import ENGINE_VERSION, inputs_hash  # noqa: F401  (dışa aktarım)
from .errors import block
from .numbers import CONTEXT, format_decimal
from .supported import SCOPE2_SOURCE_TYPES, SOURCE_TYPES

MOBILE_FUELS = ("diesel", "gasoline", "lpg", "natural_gas")
MOBILE_UNIT_FAMILIES = (U.ENERGY, U.MASS, U.VOLUME_LIQUID)

#: Kaynak türü başına izin verilen faktör sınırları (Kapsam 1 miktar × faktör yolu).
SCOPE1_BOUNDARIES = {
    "stationary_combustion": C.BOUNDARIES,
    "mobile_combustion": C.BOUNDARIES,
    "process": C.BOUNDARIES,
}


def calculate(request: object) -> dict:
    """Tek kayıt hesabı. Girdi JSON-uyumlu sözlük, çıktı JSON-uyumlu sözlük."""
    with localcontext(CONTEXT):
        try:
            return _dispatch(request)
        except DivisionByZero:
            return _fatal(request, "DIVISION_BY_ZERO")
        except (InvalidOperation, Overflow):
            return _fatal(request, "INVALID_NUMBER")


def _fatal(request: object, code: str) -> dict:
    method = {"id": None, "version": None}
    if isinstance(request, dict) and isinstance(request.get("method"), dict):
        method = {"id": request["method"].get("id"), "version": request["method"].get("version")}
    return C.response(
        method=method,
        status="blocked",
        blocks=[block(code, None, "hesap sırasında")],
        warnings=[],
        normalized_activity=None,
        components=[],
        total=None,
        coverage=None,
        claim_tr=C.CLAIM_TR["blocked"],
        boundary=None,
        trace=[{"step": "validate_input", "ok": False}],
        hash_value=inputs_hash(request),
    )


def _dispatch(request: object) -> dict:
    hash_value = inputs_hash(request)
    if not isinstance(request, dict):
        v = C.Validator()
        v.add("INVALID_REQUEST", None, "istek nesne değil")
        return C.blocked({"id": None, "version": None}, v.blocks, [], None, hash_value)

    activity = request.get("activity")
    source_type = activity.get("source_type") if isinstance(activity, dict) else None

    if source_type in ("stationary_combustion", "mobile_combustion", "process"):
        return _activity_x_factor(request, source_type, hash_value)
    if source_type == "refrigerant":
        return refrigerant.run(request, hash_value)
    if source_type in SCOPE2_SOURCE_TYPES:
        return scope2.run(request, source_type, hash_value)
    if source_type == "scope3":
        return scope3.run(request, hash_value)
    if source_type == "product_process":
        return product.run(request, hash_value)
    return _unsupported(request, source_type, hash_value)


def _unsupported(request: dict, source_type: object, hash_value: str | None) -> dict:
    """0.1 davranışı: tüm yapısal doğrulama yapılır, bloklar birlikte döner."""
    v = C.Validator()
    method_out, gwp = C.validate_method(request.get("method"), v)
    act = C.validate_activity(request.get("activity"), v)
    v.add(
        "UNSUPPORTED_SOURCE_TYPE",
        "activity.source_type",
        f"{source_type}; desteklenen: {', '.join(SOURCE_TYPES)}",
    )
    factors = C.validate_factors(request.get("factors"), v)
    trace = [C.validate_step(v, act)]
    return C.blocked(method_out, v.blocks, trace, C.single_boundary(factors), hash_value)


# --------------------------------------------------------------------------- #
# Kapsam 1: miktar × faktör (sabit yakma, hareketli yakma, proses)
# --------------------------------------------------------------------------- #


def _activity_x_factor(request: dict, source_type: str, hash_value: str | None) -> dict:
    trace: list = []
    v = C.Validator()

    method_out, gwp = C.validate_method(request.get("method"), v)
    raw_act = request.get("activity")
    act = C.validate_activity(raw_act, v)
    extra: dict = {"source_type": source_type}

    if act is not None:
        if source_type == "mobile_combustion":
            if act["fuel"] not in MOBILE_FUELS:
                v.add("INVALID_REQUEST", "activity.fuel", "yakıt " + ", ".join(MOBILE_FUELS) + " olmalı")
            if U.is_known_unit(act["unit"]) and U.unit_family(act["unit"]) not in MOBILE_UNIT_FAMILIES:
                v.add("UNIT_INCOMPATIBLE", "activity.unit", "hareketli yanma miktarı L, m3_liquid, kg, t veya enerji birimi olmalı")
            extra["vehicle_class"] = raw_act.get("vehicle_class")
        elif source_type == "process":
            process_id = raw_act.get("process_id")
            if not C.is_nonempty_str(process_id):
                v.add("PROCESS_ID_REQUIRED", "activity.process_id")
            if U.is_known_unit(act["unit"]) and U.unit_family(act["unit"]) != U.MASS:
                v.add("UNIT_INCOMPATIBLE", "activity.unit", "proses miktarı kütle birimi (t | kg) olmalı")
            extra["process_id"] = process_id

    factors = C.validate_factors(request.get("factors"), v, boundaries=SCOPE1_BOUNDARIES[source_type])

    step = C.validate_step(v, act)
    if source_type == "mobile_combustion" and act is not None:
        step["vehicle_class"] = extra["vehicle_class"]
    if source_type == "process" and act is not None:
        step["process_id"] = extra["process_id"]
    trace.append(step)

    boundary = C.single_boundary(factors)
    if v.blocks:
        return C.blocked(method_out, v.blocks, trace, boundary, hash_value, extra=extra)
    assert act is not None

    C.check_factor_set(factors, gwp, v)
    if v.blocks:
        return C.blocked(method_out, v.blocks, trace, boundary, hash_value, extra=extra)

    calc = C.compute(act, factors, gwp, trace, v)
    if calc is None:
        return C.blocked(method_out, v.blocks, trace, boundary, hash_value, extra=extra)

    warnings: list[dict] = []
    status = C.quality_warnings(act, calc["basis_conversion_used"], warnings)
    trace.append(C.result_step(calc["total"], calc["coverage"], status))

    return C.response(
        method=method_out,
        status=status,
        blocks=[],
        warnings=warnings,
        normalized_activity=calc["normalized_activity"],
        components=calc["components"],
        total=format_decimal(calc["total"]),
        coverage=calc["coverage"],
        claim_tr=calc["claim_tr"],
        boundary=boundary,
        trace=trace,
        hash_value=hash_value,
        extra=extra,
    )
