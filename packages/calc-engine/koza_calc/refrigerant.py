"""Kapsam 1 kaçak emisyon: soğutucu gaz (T11, §12 kritik istisnalar).

Kütle dengesi yaklaşımı: emisyon = kaçak sayılan miktar (kg) × GWP.
Yeni ekipman dolumu ve geri kazanım sızıntı değildir → `not_applicable`
(sıfır değil). Gaz türü bilinmiyorsa hesap bekler.
"""

from __future__ import annotations

from decimal import Decimal

from . import core as C
from . import units as U
from .errors import warning
from .numbers import format_decimal

CHARGE_TYPES = ("new_equipment_fill", "top_up", "recovered", "leak_measured", "disposal")
BOUNDARY = "fugitive"

CLAIM_TR = {
    "new_equipment_fill": "Yeni ekipman dolumu sızıntı değildir; emisyon sayılmaz.",
    "recovered": "Geri kazanılan miktar negatif kütle hareketidir; envantere emisyon yazılmaz.",
    "top_up": "Eklenen miktar kaçak telafisi varsayımıyla emisyon sayıldı; soğutucu gazın GWP ile CO₂e karşılığı.",
    "leak_measured": "Ölçülen sızıntı miktarının GWP ile CO₂e karşılığı.",
}


def _validate_refrigerant(raw: object, v: C.Validator) -> dict | None:
    if not isinstance(raw, dict):
        v.add("INVALID_REQUEST", "activity.refrigerant", "soğutucu nesnesi eksik")
        return None
    r = {
        "gas": raw.get("gas"),
        "charge_type": raw.get("charge_type"),
        "equipment_in_inventory": raw.get("equipment_in_inventory"),
    }
    if not C.is_nonempty_str(r["gas"]):
        v.add("INVALID_REQUEST", "activity.refrigerant.gas", "gaz kodu eksik; bilinmiyorsa \"unknown\" yazılır")
    if r["charge_type"] not in CHARGE_TYPES:
        v.add("INVALID_REQUEST", "activity.refrigerant.charge_type", "işlem türü " + ", ".join(CHARGE_TYPES) + " olmalı")
    if not C.is_bool(r["equipment_in_inventory"]):
        v.add("INVALID_REQUEST", "activity.refrigerant.equipment_in_inventory", "true/false zorunlu")
    return r


def _resolve_gwp(gas: str, factors: list[dict], gwp: dict, v: C.Validator) -> tuple[Decimal | None, dict | None]:
    """GWP: faktör (gas = soğutucu kodu, kg/kg) öncelikli, yoksa yöntem gwp_set."""
    if len(factors) > 1:
        v.add("FACTOR_DUPLICATE_GAS", factors[1]["field"] + ".gas", gas)
        return None, None
    if factors:
        f = factors[0]
        value = f["value"]
        # kg CO2e / kg: pay t ise ×1000, payda t ise ÷1000
        if f["numerator_unit"] != "kg":
            value, _ = U.convert_mass(value, f["numerator_unit"], "kg")
        if f["denominator_unit"] != "kg":
            value = value / U.MASS_IN_KG[f["denominator_unit"]]
        return value, f
    if gas in gwp["values"]:
        return gwp["values"][gas], None
    v.add("GWP_MISSING", f"method.gwp_set.{gas}", f"{gas} için GWP ne yöntemde ne faktörde var")
    return None, None


def run(request: dict, hash_value: str | None) -> dict:
    trace: list = []
    v = C.Validator()
    method_out, gwp = C.validate_method(request.get("method"), v)
    raw_act = request.get("activity")
    act = C.validate_activity(raw_act, v)
    r = _validate_refrigerant(raw_act.get("refrigerant") if isinstance(raw_act, dict) else None, v)

    if act is not None and U.is_known_unit(act["unit"]) and U.unit_family(act["unit"]) != U.MASS:
        v.add("UNIT_INCOMPATIBLE", "activity.unit", "soğutucu miktarı kütle birimi (kg | t) olmalı")

    gas = r["gas"] if r is not None and C.is_nonempty_str(r["gas"]) else None
    factors = C.validate_factors(
        request.get("factors"), v, gases=(gas,) if gas else C.GASES, boundaries=(BOUNDARY,), required=False
    )
    for f in factors:
        if U.is_known_unit(f["denominator_unit"]) and U.unit_family(f["denominator_unit"]) != U.MASS:
            v.add("UNIT_INCOMPATIBLE", f["field"] + ".denominator_unit", "GWP faktörünün paydası kütle (kg) olmalı")

    extra: dict = {"source_type": "refrigerant", "refrigerant": r}
    trace.append(C.validate_step(v, act))
    if v.blocks:
        return C.blocked(method_out, v.blocks, trace, BOUNDARY, hash_value, extra=extra)
    assert act is not None and r is not None and gas is not None

    # --- §12 kabul koşulları ---
    if r["equipment_in_inventory"] is False:
        v.add("EQUIPMENT_NOT_IN_INVENTORY", "activity.refrigerant.equipment_in_inventory")
    if gas == "unknown":
        v.add("REFRIGERANT_GAS_UNKNOWN", "activity.refrigerant.gas")
    if r["charge_type"] == "disposal":
        v.add("METHOD_NOT_ALLOWED", "activity.refrigerant.charge_type", "imha (disposal) için hesap kuralı bu sürümde tanımlı değil")
    if v.blocks:
        return C.blocked(method_out, v.blocks, trace, BOUNDARY, hash_value, extra=extra)

    mass_kg, ratio = U.convert_mass(act["quantity"], act["unit"], "kg")
    trace.append(
        {
            "step": "unit_conversion",
            "from": f"{format_decimal(act['quantity'])} {act['unit']}",
            "to": f"{format_decimal(mass_kg)} kg",
            "ratio": format_decimal(ratio),
            "source": U.FIXED_TABLE_SOURCE,
        }
    )
    normalized = {"quantity": format_decimal(mass_kg), "unit": "kg", "basis": None}
    charge = r["charge_type"]
    warnings: list[dict] = []

    # --- sızıntı olmayan hareketler: uygulanamaz, sıfır değil ---
    if charge in ("new_equipment_fill", "recovered"):
        if charge == "recovered":
            warnings.append(warning("RECOVERED_NOT_EMISSION"))
        trace.append(
            {
                "step": "mass_balance",
                "charge_type": charge,
                "emission": "not_applicable",
                "reason": CLAIM_TR[charge],
            }
        )
        trace.append(C.result_step(None, None, "computed", value_state="not_applicable"))
        return C.response(
            method=method_out,
            status="computed",
            blocks=[],
            warnings=warnings,
            normalized_activity=normalized,
            components=[],
            total=None,
            coverage=None,
            claim_tr=CLAIM_TR[charge],
            boundary=BOUNDARY,
            trace=trace,
            hash_value=hash_value,
            value_state="not_applicable",
            extra=extra,
        )

    # --- top_up / leak_measured: miktar × GWP ---
    gwp_value, factor = _resolve_gwp(gas, factors, gwp, v)
    if v.blocks:
        return C.blocked(method_out, v.blocks, trace, BOUNDARY, hash_value, extra=extra)
    assert gwp_value is not None

    if factor is not None:
        trace.append({"step": "factor_match", "factor_id": factor["id"], "factor_version": factor["version"], "boundary": BOUNDARY})
    co2e = mass_kg * gwp_value
    trace.append({"step": "mass_balance", "charge_type": charge, "emission": "counted", "leak_kg": format_decimal(mass_kg)})
    trace.append(
        {
            "step": "gwp",
            "gas": gas,
            "applied": True,
            "gwp": format_decimal(gwp_value),
            "gwp_set_id": gwp["id"] if factor is None else factor["gwp_set_id"],
            "formula": f"{format_decimal(mass_kg)} × {format_decimal(gwp_value)} = {format_decimal(co2e)} kg CO2e",
        }
    )
    components = [
        {
            "gas": gas,
            "factor_id": factor["id"] if factor is not None else None,
            "factor_version": factor["version"] if factor is not None else None,
            "mass_kg": format_decimal(mass_kg),
            "gwp": format_decimal(gwp_value),
            "gwp_applied": True,
            "co2e_kg": format_decimal(co2e),
        }
    ]

    status = C.quality_warnings(act, False, warnings)
    if charge == "top_up":
        warnings.append(warning("REFRIGERANT_TOPUP_ASSUMPTION"))
        status = "review_required"
    coverage = "full_ghg"
    trace.append(C.result_step(co2e, coverage, status))
    return C.response(
        method=method_out,
        status=status,
        blocks=[],
        warnings=warnings,
        normalized_activity=normalized,
        components=components,
        total=format_decimal(co2e),
        coverage=coverage,
        claim_tr=CLAIM_TR[charge],
        boundary=BOUNDARY,
        trace=trace,
        hash_value=hash_value,
        extra=extra,
    )
