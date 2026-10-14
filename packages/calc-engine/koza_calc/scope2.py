"""Kapsam 2: satın alınan elektrik/buhar/ısı/soğutma (T05, T06, §13).

Konum bazlı ve piyasa bazlı sonuçlar aynı tüketimin alternatif görünümleridir;
toplanmaz → üst düzey `total_co2e_kg = null`, her yöntem `results` altında.

Piyasa bazlı: uygun (itfa edilmiş + kalite ölçütü) sözleşmesel araçlar kendi
faktörüyle, kapsanmayan kısım artık karışım faktörüyle hesaplanır. Artık
karışım yoksa konum faktörü kullanılır ve sonuç `review_required` olur.
Araç toplamı tüketimi aşamaz (negatif emisyon yok).
"""

from __future__ import annotations

from decimal import Decimal

from . import core as C
from . import units as U
from .errors import warning
from .numbers import format_decimal
from .supported import SCOPE2_METHODS

METHODS = ("location_based", "market_based", "both")
INSTRUMENT_TYPES = ("guarantee_of_origin", "ppa", "supplier_specific", "residual_mix")
ROLES = ("location", "market_residual")

CLAIM_TOP_TR = "Konum ve piyasa bazlı sonuçlar aynı tüketimin alternatif görünümleridir; toplanmaz."


def _validate_instruments(raw: object, v: C.Validator) -> list[dict]:
    out: list[dict] = []
    if raw is None:
        return out
    if not isinstance(raw, list):
        v.add("INVALID_REQUEST", "activity.scope2.instruments", "liste bekleniyor")
        return out
    seen: set[str] = set()
    for i, item in enumerate(raw):
        field = f"activity.scope2.instruments[{i}]"
        if not isinstance(item, dict):
            v.add("INVALID_REQUEST", field, "araç nesnesi bekleniyor")
            continue
        ins: dict = {"index": i, "field": field, "id": item.get("id"), "type": item.get("type")}
        if not C.is_nonempty_str(ins["id"]):
            v.add("INVALID_REQUEST", field + ".id", "araç kimliği eksik")
        elif ins["id"] in seen:
            v.add("INSTRUMENT_DUPLICATE", field + ".id", ins["id"])
        else:
            seen.add(ins["id"])
        if ins["type"] not in INSTRUMENT_TYPES:
            v.add("INVALID_REQUEST", field + ".type", "araç türü " + ", ".join(INSTRUMENT_TYPES) + " olmalı")
        mwh = v.number(item.get("mwh"), field + ".mwh")
        if mwh is not None and mwh < 0:
            v.add("NEGATIVE_QUANTITY", field + ".mwh")
        ins["mwh"] = mwh
        for key in ("retired", "quality_criteria_met"):
            if not C.is_bool(item.get(key)):
                v.add("INVALID_REQUEST", f"{field}.{key}", "true/false zorunlu")
            ins[key] = item.get(key)
        ins["generation_period"] = item.get("generation_period")
        ins["beneficiary"] = item.get("beneficiary")
        ins["factor"] = C.validate_factor(item.get("factor"), i, v, field=field + ".factor")
        ins["eligible"] = ins["retired"] is True and ins["quality_criteria_met"] is True
        out.append(ins)
    return out


def _validate_scope2(raw: object, v: C.Validator) -> dict | None:
    if not isinstance(raw, dict):
        v.add("INVALID_REQUEST", "activity.scope2", "Kapsam 2 nesnesi eksik")
        return None
    s2: dict = {"method": raw.get("method"), "grid_region": raw.get("grid_region")}
    if s2["method"] not in METHODS:
        v.add("INVALID_REQUEST", "activity.scope2.method", "yöntem " + ", ".join(METHODS) + " olmalı")
    s2["instruments"] = _validate_instruments(raw.get("instruments"), v)
    rm = raw.get("residual_mix_factor")
    s2["residual_mix_factor"] = (
        C.validate_factor(rm, 0, v, field="activity.scope2.residual_mix_factor") if rm is not None else None
    )
    s2["self_generation_mwh"] = v.optional_number(raw.get("self_generation_mwh"), "activity.scope2.self_generation_mwh")
    s2["sold_to_grid_mwh"] = v.optional_number(raw.get("sold_to_grid_mwh"), "activity.scope2.sold_to_grid_mwh")
    return s2


def _sub_result(
    status: str, warnings: list, normalized: dict | None, components: list, total: Decimal | None,
    coverage: str | None, claim_tr: str, boundary: str | None, trace: list, **extra
) -> dict:
    out = {
        "status": status,
        "blocks": [],
        "warnings": warnings,
        "normalized_activity": normalized,
        "components": components,
        "total_co2e_kg": format_decimal(total) if total is not None else None,
        "coverage": coverage,
        "claim_tr": claim_tr,
        "boundary": boundary,
        "trace": trace,
    }
    out.update(extra)
    return out


def _location_based(act: dict, location_factors: list[dict], gwp: dict, v: C.Validator) -> dict | None:
    trace: list = []
    if not location_factors:
        v.add("INVALID_REQUEST", "factors", "konum bazlı yöntem için role: \"location\" faktörü gerekli")
        return None
    C.check_factor_set(location_factors, gwp, v)
    if v.blocks:
        return None
    calc = C.compute(act, location_factors, gwp, trace, v)
    if calc is None:
        return None
    warnings: list[dict] = []
    status = C.quality_warnings(act, calc["basis_conversion_used"], warnings)
    trace.append(C.result_step(calc["total"], calc["coverage"], status))
    return _sub_result(
        status, warnings, calc["normalized_activity"], calc["components"], calc["total"],
        calc["coverage"], calc["claim_tr"], C.single_boundary(location_factors), trace,
        factor_ids=[f["id"] for f in location_factors],
    )


def _portion_activity(act: dict, mwh: Decimal) -> dict:
    portion = dict(act)
    portion["quantity"] = mwh
    portion["unit"] = "MWh"
    return portion


def _market_based(
    act: dict, consumption_mwh: Decimal, s2: dict, location_factors: list[dict],
    residual_factors: list[dict], gwp: dict, v: C.Validator
) -> dict | None:
    trace: list = []
    warnings: list[dict] = []
    status = "computed"

    eligible = [i for i in s2["instruments"] if i["eligible"]]
    ineligible = [i for i in s2["instruments"] if not i["eligible"]]
    for ins in ineligible:
        warnings.append(warning("INSTRUMENT_NOT_ELIGIBLE", f"{ins['id']}: " + warning("INSTRUMENT_NOT_ELIGIBLE")["message_tr"]))
        trace.append({"step": "instrument", "instrument_id": ins["id"], "eligible": False, "mwh": format_decimal(ins["mwh"]), "counted_as": "uncovered"})

    covered = Decimal("0")
    for ins in eligible:
        covered += ins["mwh"]
    if covered > consumption_mwh:
        v.add(
            "INSTRUMENT_EXCEEDS_CONSUMPTION",
            "activity.scope2.instruments",
            f"araç toplamı {format_decimal(covered)} MWh > tüketim {format_decimal(consumption_mwh)} MWh",
        )
        return None
    uncovered = consumption_mwh - covered
    trace.append(
        {
            "step": "instrument_allocation",
            "consumption_mwh": format_decimal(consumption_mwh),
            "covered_mwh": format_decimal(covered),
            "uncovered_mwh": format_decimal(uncovered),
            "instrument_ids": [i["id"] for i in eligible],
        }
    )

    components: list[dict] = []
    total = Decimal("0")
    gases: set[str] = set()
    boundaries: set[str] = set()

    for ins in eligible:
        f = ins["factor"]
        portion = _portion_activity(act, ins["mwh"])
        C.check_factor_set([f], gwp, v)
        if v.blocks:
            return None
        calc = C.compute(portion, [f], gwp, trace, v)
        if calc is None:
            return None
        for comp in calc["components"]:
            comp["instrument_id"] = ins["id"]
            comp["portion_mwh"] = format_decimal(ins["mwh"])
            components.append(comp)
        total += calc["total"]
        gases.add(f["gas"])
        boundaries.add(f["boundary"])
        trace.append({"step": "instrument", "instrument_id": ins["id"], "type": ins["type"], "eligible": True,
                      "mwh": format_decimal(ins["mwh"]), "co2e_kg": format_decimal(calc["total"])})

    residual_used = "none"
    if uncovered > 0:
        if residual_factors:
            portion_factors = residual_factors
            residual_used = "residual_mix"
        elif location_factors:
            portion_factors = location_factors
            residual_used = "location_fallback"
            warnings.append(warning("RESIDUAL_MIX_UNAVAILABLE"))
            status = "review_required"
        else:
            v.add("INVALID_REQUEST", "activity.scope2.residual_mix_factor", "kapsanmayan tüketim için artık karışım veya konum faktörü gerekli")
            return None
        C.check_factor_set(portion_factors, gwp, v)
        if v.blocks:
            return None
        portion = _portion_activity(act, uncovered)
        calc = C.compute(portion, portion_factors, gwp, trace, v)
        if calc is None:
            return None
        for comp in calc["components"]:
            comp["instrument_id"] = None
            comp["portion_mwh"] = format_decimal(uncovered)
            components.append(comp)
        total += calc["total"]
        gases |= {f["gas"] for f in portion_factors}
        boundaries |= {f["boundary"] for f in portion_factors}
        if calc["basis_conversion_used"]:
            status = "review_required"
            warnings.append(warning("BASIS_CONVERSION_APPLIED"))
    trace.append({"step": "residual", "uncovered_mwh": format_decimal(uncovered), "factor_used": residual_used})

    if "CO2e" in gases and gases - {"CO2e"}:
        v.add("FACTOR_MIX_CO2E_AND_GAS", "activity.scope2", "araç ve artık karışım faktörleri aynı türde olmalı")
        return None
    if len(boundaries) > 1:
        v.add("BOUNDARY_MIX", "activity.scope2", ", ".join(sorted(boundaries)))
        return None

    if not gases:
        # Tüketim 0 ve araç yok: ölçülmüş sıfır.
        coverage, claim_tr = None, "Tüketim sıfır; piyasa bazlı emisyon ölçülmüş sıfır."
    else:
        coverage, claim_tr = C.coverage_of(gases)
    if act["data_quality"] == "estimated":
        status = "review_required"
        warnings.append(warning("DATA_QUALITY_ESTIMATED"))
    trace.append(C.result_step(total, coverage, status))
    return _sub_result(
        status, warnings, {"quantity": format_decimal(consumption_mwh), "unit": "MWh", "basis": None},
        components, total, coverage, claim_tr, next(iter(boundaries)) if len(boundaries) == 1 else None, trace,
        covered_mwh=format_decimal(covered),
        uncovered_mwh=format_decimal(uncovered),
        instrument_ids=[i["id"] for i in eligible],
        ineligible_instrument_ids=[i["id"] for i in ineligible],
        residual_factor_used=residual_used,
    )


def run(request: dict, source_type: str, hash_value: str | None) -> dict:
    trace: list = []
    v = C.Validator()
    method_out, gwp = C.validate_method(request.get("method"), v)
    raw_act = request.get("activity")
    act = C.validate_activity(raw_act, v)
    s2 = _validate_scope2(raw_act.get("scope2") if isinstance(raw_act, dict) else None, v)

    if act is not None and U.is_known_unit(act["unit"]) and U.unit_family(act["unit"]) != U.ENERGY:
        v.add("UNIT_INCOMPATIBLE", "activity.unit", "Kapsam 2 miktarı enerji birimi (kWh, MWh, GJ, MJ) olmalı")

    factors = C.validate_factors(request.get("factors"), v, required=False)
    for f in factors:
        if f["role"] not in ROLES:
            v.add("INVALID_REQUEST", f["field"] + ".role", "Kapsam 2 faktöründe role: " + " | ".join(ROLES) + " zorunlu")
    location_factors = [f for f in factors if f["role"] == "location"]
    residual_factors = [f for f in factors if f["role"] == "market_residual"]
    if s2 is not None and s2["residual_mix_factor"] is not None:
        residual_factors = [s2["residual_mix_factor"]]

    primary = None
    requested: list[str] = []
    if s2 is not None and s2["method"] in METHODS:
        primary = "location_based" if s2["method"] == "both" else s2["method"]
        requested = list(SCOPE2_METHODS) if s2["method"] == "both" else [s2["method"]]

    extra: dict = {
        "source_type": source_type,
        "scope2_method": s2["method"] if s2 is not None else None,
        "primary_method": primary,
        "grid_region": s2["grid_region"] if s2 is not None else None,
        "results": None,
    }
    trace.append(C.validate_step(v, act))
    if v.blocks:
        return C.blocked(method_out, v.blocks, trace, None, hash_value, scope=2, extra=extra)
    assert act is not None and s2 is not None

    consumption_mwh, ratio = U.convert_energy(act["quantity"], act["unit"], "MWh")
    trace.append(
        {
            "step": "unit_conversion",
            "from": f"{format_decimal(act['quantity'])} {act['unit']}",
            "to": f"{format_decimal(consumption_mwh)} MWh",
            "ratio": format_decimal(ratio),
            "source": U.FIXED_TABLE_SOURCE,
        }
    )
    trace.append(
        {
            "step": "self_generation",
            "self_generation_mwh": format_decimal(s2["self_generation_mwh"]) if s2["self_generation_mwh"] is not None else None,
            "sold_to_grid_mwh": format_decimal(s2["sold_to_grid_mwh"]) if s2["sold_to_grid_mwh"] is not None else None,
            "note": "Şebekeye satılan enerji brüt sonuçtan düşülmez (§13).",
        }
    )

    results: dict = {}
    if "location_based" in requested:
        results["location_based"] = _location_based(act, location_factors, gwp, v)
    if "market_based" in requested and not v.blocks:
        results["market_based"] = _market_based(act, consumption_mwh, s2, location_factors, residual_factors, gwp, v)
    if v.blocks:
        return C.blocked(method_out, v.blocks, trace, None, hash_value, scope=2, extra=extra)

    warnings: list[dict] = []
    status = "computed"
    for name in requested:
        sub = results[name]
        for w in sub["warnings"]:
            tagged = dict(w)
            tagged["method"] = name
            warnings.append(tagged)
        if sub["status"] == "review_required":
            status = "review_required"
        trace.append(
            {
                "step": "scope2_method",
                "method": name,
                "total_co2e_kg": sub["total_co2e_kg"],
                "coverage": sub["coverage"],
                "status": sub["status"],
                "primary": name == primary,
            }
        )
    trace.append(C.result_step(None, None, status, note="iki yöntem toplanmaz"))
    extra["results"] = results
    boundaries = {r["boundary"] for r in results.values()}
    return C.response(
        method=method_out,
        status=status,
        blocks=[],
        warnings=warnings,
        normalized_activity={"quantity": format_decimal(consumption_mwh), "unit": "MWh", "basis": None},
        components=[],
        total=None,
        coverage=None,
        claim_tr=CLAIM_TOP_TR,
        boundary=next(iter(boundaries)) if len(boundaries) == 1 else None,
        trace=trace,
        hash_value=hash_value,
        scope=2,
        extra=extra,
    )
