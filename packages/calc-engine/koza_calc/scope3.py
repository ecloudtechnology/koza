"""Kapsam 3 kategori 1–15 (T08, T09, T10, T12, MTH; §14–§16).

Her kategori için izin verilen yöntemler `SUPPORTED["scope3"]` içindedir.
Uygulanamazlık gerekçeli karardır (`not_applicable`, sıfır değil); veri
eksikliği uygulanamazlık değildir (`unknown`, bloke `DATA_MISSING`).
"""

from __future__ import annotations

from decimal import Decimal

from . import core as C
from . import units as U
from .errors import warning
from .numbers import format_decimal
from .supported import scope3_methods

METHODS = (
    "supplier_specific", "hybrid", "average_data", "spend_based", "distance_based",
    "fuel_based", "waste_type_specific", "lifetime_use", "investment_specific",
)
APPLICABILITY = ("applicable", "not_applicable", "unknown")
BOUNDARIES = (
    "cradle_to_gate", "gate_to_gate", "cradle_to_grave", "upstream",
    "well_to_tank", "tank_to_wheel", "well_to_wheel", "end_of_life",
)
DQ_DIMS = ("technology", "geography", "time", "completeness", "reliability")

CLAIM_NA_TR = "Kategori bu kuruluş için uygulanamaz (gerekçeli karar); emisyon hesaplanmaz, sıfır sayılmaz."
CLAIM_PARTIAL_BOUNDARY_TR = "Kapıdan kapıya faktörle hesaplandı; üst aşamalar eksik, kısmi sınır sonucudur."


def _category(raw: object, v: C.Validator) -> int | None:
    if isinstance(raw, bool):
        v.add("INVALID_REQUEST", "activity.scope3.category", "kategori 1–15 arası tamsayı olmalı")
        return None
    if isinstance(raw, str) and raw.isdigit():
        raw = int(raw)
    if not isinstance(raw, int) or not 1 <= raw <= 15:
        v.add("INVALID_REQUEST", "activity.scope3.category", "kategori 1–15 arası tamsayı olmalı")
        return None
    return raw


def _validate_scope3(raw: object, v: C.Validator) -> dict | None:
    if not isinstance(raw, dict):
        v.add("INVALID_REQUEST", "activity.scope3", "Kapsam 3 nesnesi eksik")
        return None
    s3: dict = {
        "category": _category(raw.get("category"), v),
        "method": raw.get("method"),
        "applicability": raw.get("applicability"),
        "not_applicable_reason": raw.get("not_applicable_reason"),
        "data_quality_dims": raw.get("data_quality_dims"),
        "spend": raw.get("spend"),
        "sold_products": raw.get("sold_products"),
    }
    if s3["applicability"] not in APPLICABILITY:
        v.add("INVALID_REQUEST", "activity.scope3.applicability", "uygulanabilirlik " + ", ".join(APPLICABILITY) + " olmalı")
    if s3["method"] is not None and s3["method"] not in METHODS:
        v.add("INVALID_REQUEST", "activity.scope3.method", "yöntem tanınmıyor")
    dq = s3["data_quality_dims"]
    if dq is not None:
        if not isinstance(dq, dict) or not all(isinstance(k, str) and isinstance(val, str) for k, val in dq.items()):
            v.add("INVALID_REQUEST", "activity.scope3.data_quality_dims", "boyut -> \"1\"..\"5\" dize sözlüğü bekleniyor")
        else:
            unknown = sorted(set(dq) - set(DQ_DIMS))
            if unknown:
                v.add("INVALID_REQUEST", "activity.scope3.data_quality_dims", "bilinmeyen boyut: " + ", ".join(unknown))
    return s3


def _validate_spend(raw: object, v: C.Validator) -> dict | None:
    if not isinstance(raw, dict):
        v.add("INVALID_REQUEST", "activity.scope3.spend", "harcama bazlı yöntem için spend nesnesi zorunlu")
        return None
    spend: dict = {
        "currency": raw.get("currency"),
        "date": raw.get("date"),
        "tax_treatment": raw.get("tax_treatment"),
        "sector_class": raw.get("sector_class"),
        "price_year": raw.get("price_year"),
        "deflator": None,
    }
    if not U.is_currency(spend["currency"]):
        v.add("CURRENCY_MISMATCH", "activity.scope3.spend.currency", "para birimi TRY, EUR veya USD olmalı")
    d_raw = raw.get("deflator")
    if d_raw is not None:
        if not isinstance(d_raw, dict):
            v.add("INVALID_REQUEST", "activity.scope3.spend.deflator", "nesne bekleniyor")
        else:
            value = v.number(d_raw.get("value"), "activity.scope3.spend.deflator.value")
            if value is not None and value <= 0:
                v.add("INVALID_NUMBER", "activity.scope3.spend.deflator.value", "deflatör pozitif olmalı")
                value = None
            if not C.is_nonempty_str(d_raw.get("source_ref")):
                v.add("INVALID_REQUEST", "activity.scope3.spend.deflator.source_ref", "deflatörün kaynağı zorunlu")
            spend["deflator"] = {"value": value, "source_ref": d_raw.get("source_ref")}
    return spend


def _validate_sold_products(raw: object, v: C.Validator) -> dict | None:
    if not isinstance(raw, dict):
        v.add("INVALID_REQUEST", "activity.scope3.sold_products", "lifetime_use için sold_products nesnesi zorunlu")
        return None
    sp: dict = {"sale_year": raw.get("sale_year"), "group_id": raw.get("group_id")}
    if not C.is_nonempty_str(sp["sale_year"]):
        v.add("INVALID_REQUEST", "activity.scope3.sold_products.sale_year", "satış yılı zorunlu")
    if not C.is_nonempty_str(sp["group_id"]):
        v.add("INVALID_REQUEST", "activity.scope3.sold_products.group_id", "satış grubu kimliği zorunlu (tekrar eklememe kontrolü için)")
    for key in ("lifetime_years", "annual_use_kwh"):
        if raw.get(key) is None:
            v.add("DEFAULT_SCENARIO_FORBIDDEN", f"activity.scope3.sold_products.{key}")
            sp[key] = None
        else:
            sp[key] = v.number(raw.get(key), f"activity.scope3.sold_products.{key}")
            if sp[key] is not None and sp[key] < 0:
                v.add("NEGATIVE_QUANTITY", f"activity.scope3.sold_products.{key}")
    units_sold = raw.get("units_sold")
    if units_sold is None:
        sp["units_sold"] = None
    else:
        sp["units_sold"] = v.number(units_sold, "activity.scope3.sold_products.units_sold")
        if sp["units_sold"] is not None and sp["units_sold"] < 0:
            v.add("NEGATIVE_QUANTITY", "activity.scope3.sold_products.units_sold")
    return sp


def _blocked(method_out, v, trace, boundary, hash_value, extra, value_state="known"):
    return C.blocked(method_out, v.blocks, trace, boundary, hash_value, scope=3, value_state=value_state, extra=extra)


def run(request: dict, hash_value: str | None) -> dict:
    trace: list = []
    v = C.Validator()
    method_out, gwp = C.validate_method(request.get("method"), v)
    raw_act = request.get("activity")
    s3 = _validate_scope3(raw_act.get("scope3") if isinstance(raw_act, dict) else None, v)
    act = C.validate_activity(raw_act, v, allow_null_quantity=True)

    category = s3["category"] if s3 is not None else None
    s3_method = s3["method"] if s3 is not None else None
    applicability = s3["applicability"] if s3 is not None else None
    extra: dict = {
        "source_type": "scope3",
        "category": category,
        "scope3_method": s3_method,
        "applicability": applicability,
        "not_applicable_reason": s3["not_applicable_reason"] if s3 is not None else None,
        "data_quality_dims": s3["data_quality_dims"] if s3 is not None else None,
        "lifetime_group": None,
        "attribution_year": None,
    }

    # --- yöntem matrisi (MTH-03) ---
    if category is not None and s3_method is not None and s3_method not in scope3_methods(category):
        v.add(
            "METHOD_NOT_ALLOWED",
            "activity.scope3.method",
            f"kategori {category} için izin verilen: {', '.join(scope3_methods(category))}",
        )

    # --- uygulanamazlık: gerekçeli karar (T10) ---
    if applicability == "not_applicable":
        if not C.is_nonempty_str(extra["not_applicable_reason"]):
            v.add("NA_REASON_REQUIRED", "activity.scope3.not_applicable_reason")
        trace.append(C.validate_step(v, act, category=category))
        if v.blocks:
            return _blocked(method_out, v, trace, None, hash_value, extra)
        trace.append({"step": "applicability", "value_state": "not_applicable", "reason": extra["not_applicable_reason"]})
        trace.append(C.result_step(None, None, "computed", value_state="not_applicable"))
        return C.response(
            method=method_out, status="computed", blocks=[], warnings=[], normalized_activity=None,
            components=[], total=None, coverage=None, claim_tr=CLAIM_NA_TR, boundary=None, trace=trace,
            hash_value=hash_value, scope=3, value_state="not_applicable", extra=extra,
        )

    if s3 is not None and s3_method is None:
        v.add("INVALID_REQUEST", "activity.scope3.method", "yöntem zorunlu")

    # --- yönteme özgü girdiler ---
    spend = sold = None
    if s3_method == "spend_based":
        spend = _validate_spend(s3["spend"], v)
    if s3_method == "lifetime_use":
        sold = _validate_sold_products(s3["sold_products"], v)
        if sold is not None and sold["group_id"] is not None:
            extra["lifetime_group"] = {"group_id": sold["group_id"], "sale_year": sold["sale_year"]}
            extra["attribution_year"] = sold["sale_year"]

    # --- veri eksikliği uygulanamazlık değildir (T10) ---
    quantity_missing = (
        act is not None and act["quantity"] is None
        if s3_method != "lifetime_use"
        else sold is not None and sold["units_sold"] is None
    )
    if applicability == "unknown" or quantity_missing:
        field = "activity.quantity" if s3_method != "lifetime_use" else "activity.scope3.sold_products.units_sold"
        if applicability == "unknown":
            field = "activity.scope3.applicability"
        v.add("DATA_MISSING", field, "değer bilinmiyor; sıfır veya uygulanamaz sayılmaz")
        trace.append(C.validate_step(v, act, category=category))
        return _blocked(method_out, v, trace, None, hash_value, extra, value_state="unknown")

    if act is not None and act["quantity"] is None and s3_method != "lifetime_use":
        v.add("INVALID_NUMBER", "activity.quantity", "sayı dize olmalı")
    if act is not None and act["quantity"] is not None and s3_method == "lifetime_use":
        trace.append({"step": "note", "text": "lifetime_use: activity.quantity kullanılmadı; miktar sold_products'tan türetildi"})

    factors = C.validate_factors(request.get("factors"), v, boundaries=BOUNDARIES)
    trace.append(C.validate_step(v, act, category=category))
    boundary = C.single_boundary(factors)
    if v.blocks:
        return _blocked(method_out, v, trace, boundary, hash_value, extra)
    assert act is not None and s3 is not None and category is not None

    # --- sınır kuralları (§17, T08, T09) ---
    boundaries = {f["boundary"] for f in factors}
    if "cradle_to_grave" in boundaries and category in (1, 2):
        v.add("LCA_FACTOR_IN_CATEGORY", "factors", f"kategori {category}")
    overlap = "cradle_to_gate" in boundaries and "upstream" in boundaries
    if overlap:
        v.add("BOUNDARY_OVERLAP", "factors", "cradle_to_gate + upstream")
    C.check_factor_set(factors, gwp, v, check_boundary_mix=not overlap, duplicate_by_boundary=overlap)
    if s3_method == "spend_based" and spend is not None:
        if not U.is_currency(act["unit"]):
            v.add("UNIT_INCOMPATIBLE", "activity.unit", "harcama bazlı yöntemde miktar para birimi (TRY, EUR, USD) olmalı")
        elif spend["currency"] != act["unit"]:
            v.add("CURRENCY_MISMATCH", "activity.scope3.spend.currency", f"{spend['currency']} ≠ {act['unit']}")
        for f in factors:
            if not U.is_currency(f["denominator_unit"]):
                v.add("UNIT_INCOMPATIBLE", f["field"] + ".denominator_unit", "harcama bazlı faktörün paydası para birimi olmalı")
    if v.blocks:
        return _blocked(method_out, v, trace, boundary, hash_value, extra)

    # --- yönteme özgü miktar türetme ---
    calc_act = dict(act)
    if s3_method == "lifetime_use" and sold is not None:
        derived = sold["units_sold"] * sold["annual_use_kwh"] * sold["lifetime_years"]
        calc_act["quantity"] = derived
        calc_act["unit"] = "kWh"
        trace.append(
            {
                "step": "lifetime_use",
                "formula": f"{format_decimal(sold['units_sold'])} adet × {format_decimal(sold['annual_use_kwh'])} kWh/yıl × "
                f"{format_decimal(sold['lifetime_years'])} yıl = {format_decimal(derived)} kWh",
                "sale_year": sold["sale_year"],
                "group_id": sold["group_id"],
                "note": "Ömür boyu kullanım satış yılına atfedilir; aynı satış grubu sonraki yıllarda yeniden eklenmez (depo kontrolü).",
            }
        )
    if s3_method == "spend_based" and spend is not None and spend["deflator"] is not None and spend["deflator"]["value"] is not None:
        adjusted = act["quantity"] * spend["deflator"]["value"]
        trace.append(
            {
                "step": "deflator",
                "from": f"{format_decimal(act['quantity'])} {act['unit']} ({spend['date']})",
                "to": f"{format_decimal(adjusted)} {act['unit']} (fiyat yılı {spend['price_year']})",
                "ratio": format_decimal(spend["deflator"]["value"]),
                "source": spend["deflator"]["source_ref"],
            }
        )
        calc_act["quantity"] = adjusted

    calc = C.compute(calc_act, factors, gwp, trace, v)
    if calc is None:
        return _blocked(method_out, v, trace, boundary, hash_value, extra)

    warnings: list[dict] = []
    status = C.quality_warnings(act, calc["basis_conversion_used"], warnings)
    coverage, claim_tr = calc["coverage"], calc["claim_tr"]
    if category == 1 and boundary == "gate_to_gate":
        warnings.append(warning("UPSTREAM_MISSING"))
        coverage, claim_tr = "partial_boundary", CLAIM_PARTIAL_BOUNDARY_TR
        status = "review_required"
    if s3_method == "spend_based" and spend is not None:
        warnings.append(warning("SPEND_BASED_ESTIMATE"))
        status = "review_required"
        spend_out = {k: val for k, val in spend.items() if k != "deflator"}
        spend_out["deflator"] = (
            {"value": format_decimal(spend["deflator"]["value"]), "source_ref": spend["deflator"]["source_ref"]}
            if spend["deflator"] is not None and spend["deflator"]["value"] is not None
            else None
        )
        extra["spend"] = spend_out
    extra["gas_coverage"] = calc["coverage"]
    trace.append(C.result_step(calc["total"], coverage, status))
    return C.response(
        method=method_out,
        status=status,
        blocks=[],
        warnings=warnings,
        normalized_activity=calc["normalized_activity"],
        components=calc["components"],
        total=format_decimal(calc["total"]),
        coverage=coverage,
        claim_tr=claim_tr,
        boundary=boundary,
        trace=trace,
        hash_value=hash_value,
        scope=3,
        extra=extra,
    )
