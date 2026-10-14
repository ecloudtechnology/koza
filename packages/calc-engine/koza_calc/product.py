"""Ürün çalışması (§17): `product_process` kaynak türü.

Sonuç `context="product"`; kurumsal toplama girmez (kural 8). Yalnız karbon
hesaplandığı için `coverage="carbon_only"`; iddia metni faktörün gerçek
sınırına göre "ürün karbon ayak izi" ya da "kısmi ürün karbon ayak izi" olur.
Tam LCA/EPD iddiası yoktur. Kullanıcının seçtiği çalışma sınırı faktörün
gerçek sınırını değiştirmez; uyuşmazlık uyarı + inceleme üretir.
"""

from __future__ import annotations

from decimal import Decimal

from . import core as C
from . import units as U
from .errors import warning
from .numbers import format_decimal

STUDY_BOUNDARIES = ("gate_to_gate", "cradle_to_gate", "cradle_to_grave", "custom")
FULL_BOUNDARIES = ("cradle_to_gate", "cradle_to_grave")
ALLOCATION_BASES = ("mass", "energy", "economic", "none")

BOUNDARY_LABEL_TR = {
    "gate_to_gate": "kapıdan kapıya",
    "cradle_to_gate": "beşikten kapıya",
    "cradle_to_grave": "beşikten mezara",
    "custom": "özel kısmi sınır",
}
NO_LCA_TR = "Tam LCA veya EPD belgesi değildir."


def _label(boundary: str | None) -> str:
    return BOUNDARY_LABEL_TR.get(boundary or "", str(boundary))


def _validate_product(raw: object, v: C.Validator) -> dict | None:
    if not isinstance(raw, dict):
        v.add("INVALID_REQUEST", "activity.product", "ürün çalışması nesnesi eksik")
        return None
    p: dict = {
        "study_id": raw.get("study_id"),
        "boundary": raw.get("boundary"),
        "functional_unit": raw.get("functional_unit"),
        "reference_flow": None,
        "allocation": None,
    }
    if not C.is_nonempty_str(p["study_id"]):
        v.add("INVALID_REQUEST", "activity.product.study_id", "çalışma kimliği zorunlu")
    if p["boundary"] not in STUDY_BOUNDARIES:
        v.add("INVALID_REQUEST", "activity.product.boundary", "sınır " + ", ".join(STUDY_BOUNDARIES) + " olmalı")

    rf = raw.get("reference_flow")
    if not isinstance(rf, dict):
        v.add("INVALID_REQUEST", "activity.product.reference_flow", "referans akış {quantity, unit} zorunlu")
    else:
        q = v.number(rf.get("quantity"), "activity.product.reference_flow.quantity")
        if q is not None and q <= 0:
            v.add("INVALID_NUMBER", "activity.product.reference_flow.quantity", "referans akış pozitif olmalı")
        if not U.is_known_unit(rf.get("unit")):
            v.add("UNIT_UNKNOWN", "activity.product.reference_flow.unit", str(rf.get("unit")))
        p["reference_flow"] = {"quantity": q, "unit": rf.get("unit")}

    al = raw.get("allocation")
    if al is not None:
        if not isinstance(al, dict):
            v.add("ALLOCATION_INVALID", "activity.product.allocation", "nesne bekleniyor")
        else:
            a: dict = {"basis": al.get("basis"), "share": None, "source_ref": al.get("source_ref")}
            if a["basis"] not in ALLOCATION_BASES:
                v.add("ALLOCATION_INVALID", "activity.product.allocation.basis", "temel " + ", ".join(ALLOCATION_BASES) + " olmalı")
            if a["basis"] == "none":
                if al.get("share") is not None:
                    share = v.number(al.get("share"), "activity.product.allocation.share")
                    if share is not None and share != 1:
                        v.add("ALLOCATION_INVALID", "activity.product.allocation.share", "basis none ile pay 1 dışında olamaz")
                a["share"] = Decimal("1")
            else:
                share = v.number(al.get("share"), "activity.product.allocation.share")
                if share is not None and not (0 <= share <= 1):
                    v.add("ALLOCATION_INVALID", "activity.product.allocation.share", f"pay {format_decimal(share)}")
                    share = None
                a["share"] = share
                if not C.is_nonempty_str(a["source_ref"]):
                    v.add("ALLOCATION_INVALID", "activity.product.allocation.source_ref", "tahsis oranının kaynağı yok")
            p["allocation"] = a
    return p


def _claim(boundary: str | None) -> tuple[bool, str]:
    """(kısmi mi, iddia metni) — faktörün gerçek sınırına göre."""
    if boundary in FULL_BOUNDARIES:
        return False, f"Ürün karbon ayak izi ({_label(boundary)}); yalnız karbon. {NO_LCA_TR}"
    return True, f"Kısmi ürün karbon ayak izi ({_label(boundary)}); üst veya alt aşamalar kapsanmaz. {NO_LCA_TR}"


def run(request: dict, hash_value: str | None) -> dict:
    trace: list = []
    v = C.Validator()
    method_out, gwp = C.validate_method(request.get("method"), v)
    raw_act = request.get("activity")
    act = C.validate_activity(raw_act, v)
    p = _validate_product(raw_act.get("product") if isinstance(raw_act, dict) else None, v)
    factors = C.validate_factors(request.get("factors"), v)

    product_out = None
    if p is not None:
        product_out = {
            "study_id": p["study_id"],
            "boundary": p["boundary"],
            "functional_unit": p["functional_unit"],
            "reference_flow": (
                {"quantity": format_decimal(p["reference_flow"]["quantity"]), "unit": p["reference_flow"]["unit"]}
                if p["reference_flow"] is not None and p["reference_flow"]["quantity"] is not None
                else None
            ),
            "allocation": (
                {
                    "basis": p["allocation"]["basis"],
                    "share": format_decimal(p["allocation"]["share"]) if p["allocation"]["share"] is not None else None,
                    "source_ref": p["allocation"]["source_ref"],
                }
                if p["allocation"] is not None
                else None
            ),
        }
    extra: dict = {"source_type": "product_process", "product": product_out, "gas_coverage": None}
    trace.append(C.validate_step(v, act, study_id=p["study_id"] if p else None))
    boundary = C.single_boundary(factors)
    if v.blocks:
        return C.blocked(method_out, v.blocks, trace, boundary, hash_value, context="product", scope=None, extra=extra)
    assert act is not None and p is not None

    C.check_factor_set(factors, gwp, v)
    if v.blocks:
        return C.blocked(method_out, v.blocks, trace, boundary, hash_value, context="product", scope=None, extra=extra)

    calc = C.compute(act, factors, gwp, trace, v)
    if calc is None:
        return C.blocked(method_out, v.blocks, trace, boundary, hash_value, context="product", scope=None, extra=extra)

    components = calc["components"]
    total = calc["total"]
    if p["allocation"] is not None and p["allocation"]["basis"] != "none":
        share = p["allocation"]["share"]
        before = total
        total = total * share
        for comp in components:
            comp["mass_kg"] = format_decimal(Decimal(comp["mass_kg"]) * share)
            comp["co2e_kg"] = format_decimal(Decimal(comp["co2e_kg"]) * share)
        trace.append(
            {
                "step": "allocation",
                "basis": p["allocation"]["basis"],
                "share": format_decimal(share),
                "formula": f"{format_decimal(before)} × {format_decimal(share)} = {format_decimal(total)} kg CO2e",
                "source": p["allocation"]["source_ref"],
            }
        )

    warnings: list[dict] = []
    status = C.quality_warnings(act, calc["basis_conversion_used"], warnings)
    partial, claim_tr = _claim(boundary)
    if partial:
        warnings.append(warning("PARTIAL_BOUNDARY"))
    if p["boundary"] != "custom" and p["boundary"] != boundary:
        warnings.append(
            warning(
                "PARTIAL_BOUNDARY",
                f"Çalışma sınırı ({_label(p['boundary'])}) ile faktör sınırı ({_label(boundary)}) farklı; "
                "faktörün gerçek sınırı kullanıcı seçimiyle değişmez, inceleme gerekli.",
            )
        )
        status = "review_required"

    extra["gas_coverage"] = calc["coverage"]
    trace.append(C.result_step(total, "carbon_only", status, context="product"))
    return C.response(
        method=method_out,
        status=status,
        blocks=[],
        warnings=warnings,
        normalized_activity=calc["normalized_activity"],
        components=components,
        total=format_decimal(total),
        coverage="carbon_only",
        claim_tr=claim_tr,
        boundary=boundary,
        trace=trace,
        hash_value=hash_value,
        context="product",
        scope=None,
        extra=extra,
    )
