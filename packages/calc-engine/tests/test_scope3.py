"""Kapsam 3 (T08, T09, T10, T12, MTH; §14–§16)."""
import pytest

from koza_calc import SUPPORTED, calculate
from tests.conftest_v02 import activity2, codes, factor2, request2, wcodes

C2G = factor2("C2G", "2", "kg", boundary="cradle_to_gate")
G2G = factor2("G2G", "1.5", "kg", boundary="gate_to_gate")
UP = factor2("UP", "0.5", "kg", boundary="upstream")
LCA = factor2("LCA", "3", "kg", boundary="cradle_to_grave")
USE = factor2("USE", "0.4", "kWh", boundary="well_to_wheel")
SOLD = {"sale_year": "2026", "lifetime_years": "10", "annual_use_kwh": "120", "units_sold": "1000", "group_id": "grp-A"}
SPEND = {"currency": "TRY", "date": "2026-03-01", "tax_treatment": "excl_vat", "sector_class": "NACE C24", "price_year": "2024",
         "deflator": {"value": "1.1", "source_ref": "x"}}


def req(category, method, quantity, unit, factors, applicability="applicable", reason=None, spend=None, sold=None, dims=None, **over):
    s3 = {"category": category, "method": method, "applicability": applicability, "not_applicable_reason": reason,
          "data_quality_dims": dims, "spend": spend, "sold_products": sold}
    return request2(activity2("scope3", quantity, unit, scope3=s3, **over), factors)


def test_t08_cat1_gate_to_gate_partial_boundary():
    r = calculate(req(1, "average_data", "1000", "kg", [G2G]))
    assert r["status"] == "review_required" and r["total_co2e_kg"] == "1500"
    assert r["coverage"] == "partial_boundary" and r["gas_coverage"] == "co2e_factor"
    assert wcodes(r) == ["UPSTREAM_MISSING"] and r["scope"] == 3 and r["category"] == 1
    # kategori 4'te kapıdan kapıya uyarı üretmez
    r = calculate(req(4, "distance_based", "100", "t.km", [factor2("T", "0.1", "t.km", boundary="gate_to_gate")]))
    assert r["status"] == "computed" and r["coverage"] == "co2e_factor"


def test_t09_overlap_and_lca_blocks():
    r = calculate(req(1, "average_data", "1000", "kg", [C2G, UP]))
    assert codes(r) == ["BOUNDARY_OVERLAP"]
    r = calculate(req(2, "average_data", "1000", "kg", [LCA]))
    assert codes(r) == ["LCA_FACTOR_IN_CATEGORY"]
    # kategori 12'de beşikten mezara olmayan ömür sonu faktörü serbest; kategori 1-2 dışı LCA bloke değil
    r = calculate(req(10, "average_data", "10", "kg", [LCA]))
    assert r["status"] == "computed"
    # farklı sınır (çakışma değil) → 0.1 kuralı BOUNDARY_MIX
    r = calculate(req(4, "fuel_based", "10", "L", [factor2("WTT", "0.5", "L", boundary="well_to_tank"), factor2("TTW", "2.5", "L", gas="CO2", boundary="tank_to_wheel")]))
    assert "BOUNDARY_MIX" in codes(r)


def test_t10_states_distinct():
    r = calculate(req(1, "average_data", None, "kg", [C2G]))
    assert r["status"] == "blocked" and r["value_state"] == "unknown" and codes(r) == ["DATA_MISSING"]
    r = calculate(req(1, "average_data", "0", "kg", [C2G]))
    assert r["status"] == "computed" and r["total_co2e_kg"] == "0" and r["value_state"] == "known"
    r = calculate(req(14, None, None, None, [], applicability="not_applicable", reason="Franchise yok"))
    assert r["status"] == "computed" and r["total_co2e_kg"] is None and r["value_state"] == "not_applicable"
    assert r["components"] == [] and r["coverage"] is None and r["not_applicable_reason"] == "Franchise yok"
    r = calculate(req(14, None, None, None, [], applicability="not_applicable", reason="  "))
    assert codes(r) == ["NA_REASON_REQUIRED"]
    r = calculate(req(8, "average_data", "10", "MWh", [USE], applicability="unknown"))
    assert codes(r) == ["DATA_MISSING"] and r["value_state"] == "unknown"
    r = calculate(req(8, "average_data", "10", "MWh", [USE], applicability="belki"))
    assert "INVALID_REQUEST" in codes(r)


def test_na_record_with_disallowed_method_still_blocks():
    r = calculate(req(14, "spend_based", None, None, [], applicability="not_applicable", reason="x"))
    assert codes(r) == ["METHOD_NOT_ALLOWED"]


def test_t12_lifetime_use():
    r = calculate(req(11, "lifetime_use", None, None, [USE], sold=SOLD))
    assert r["status"] == "computed" and r["total_co2e_kg"] == "480000"
    assert r["lifetime_group"] == {"group_id": "grp-A", "sale_year": "2026"} and r["attribution_year"] == "2026"
    assert r["normalized_activity"] == {"quantity": "1200000", "unit": "kWh", "basis": None}
    lt = [t for t in r["trace"] if t["step"] == "lifetime_use"][0]
    assert lt["formula"].startswith("1000 adet × 120 kWh/yıl × 10 yıl = 1200000 kWh")
    # ikinci koşu engel değil (motor durumsuz)
    assert calculate(req(11, "lifetime_use", None, None, [USE], sold=SOLD))["total_co2e_kg"] == "480000"


@pytest.mark.parametrize("missing", ["lifetime_years", "annual_use_kwh"])
def test_t12_missing_scenario_forbidden(missing):
    r = calculate(req(11, "lifetime_use", None, None, [USE], sold=dict(SOLD, **{missing: None})))
    assert codes(r) == ["DEFAULT_SCENARIO_FORBIDDEN"]
    assert r["blocks"][0]["field"] == f"activity.scope3.sold_products.{missing}"


def test_t12_units_sold_unknown_and_group_required():
    r = calculate(req(11, "lifetime_use", None, None, [USE], sold=dict(SOLD, units_sold=None)))
    assert codes(r) == ["DATA_MISSING"] and r["value_state"] == "unknown"
    r = calculate(req(11, "lifetime_use", None, None, [USE], sold=dict(SOLD, group_id=None)))
    assert "INVALID_REQUEST" in codes(r)
    r = calculate(req(11, "lifetime_use", None, None, [USE], sold=None))
    assert "INVALID_REQUEST" in codes(r)
    r = calculate(req(11, "lifetime_use", "5", "kWh", [USE], sold=SOLD))
    assert r["total_co2e_kg"] == "480000" and any(t["step"] == "note" for t in r["trace"])


def test_spend_based_currency_rules():
    f = factor2("S", "0.0005", "TRY", boundary="cradle_to_gate")
    r = calculate(req(1, "spend_based", "100000", "TRY", [f], spend=SPEND))
    assert r["status"] == "review_required" and r["total_co2e_kg"] == "55" and wcodes(r) == ["SPEND_BASED_ESTIMATE"]
    d = [t for t in r["trace"] if t["step"] == "deflator"][0]
    assert d["ratio"] == "1.1" and d["source"] == "x"
    assert r["spend"]["deflator"] == {"value": "1.1", "source_ref": "x"} and r["spend"]["currency"] == "TRY"
    r = calculate(req(1, "spend_based", "100000", "TRY", [f], spend=dict(SPEND, deflator=None)))
    assert r["total_co2e_kg"] == "50" and r["spend"]["deflator"] is None
    r = calculate(req(1, "spend_based", "100000", "TRY", [factor2("E", "0.02", "EUR", boundary="cradle_to_gate")], spend=dict(SPEND, deflator=None)))
    assert codes(r) == ["CURRENCY_MISMATCH"]
    r = calculate(req(1, "spend_based", "100000", "EUR", [f], spend=dict(SPEND, deflator=None)))
    assert codes(r) == ["CURRENCY_MISMATCH"] and r["blocks"][0]["field"] == "activity.scope3.spend.currency"
    r = calculate(req(1, "spend_based", "100000", "TRY", [f], spend=None))
    assert "INVALID_REQUEST" in codes(r)
    r = calculate(req(1, "spend_based", "100000", "TRY", [f], spend=dict(SPEND, deflator={"value": "1.1", "source_ref": ""})))
    assert "INVALID_REQUEST" in codes(r)
    r = calculate(req(1, "spend_based", "1000", "kg", [f], spend=dict(SPEND, deflator=None)))
    assert "UNIT_INCOMPATIBLE" in codes(r)


def test_method_matrix_enforced():
    for cat, methods in SUPPORTED["scope3"].items():
        for m in ("supplier_specific", "hybrid", "average_data", "spend_based", "distance_based", "fuel_based",
                  "waste_type_specific", "lifetime_use", "investment_specific"):
            if m in methods or m in ("lifetime_use", "spend_based"):
                continue
            r = calculate(req(int(cat), m, "1", "kg", [C2G if int(cat) > 2 else G2G]))
            assert "METHOD_NOT_ALLOWED" in codes(r), (cat, m)
    r = calculate(req(1, "uydurma", "1", "kg", [C2G]))
    assert "INVALID_REQUEST" in codes(r)
    r = calculate(req(16, "average_data", "1", "kg", [C2G]))
    assert "INVALID_REQUEST" in codes(r)
    r = calculate(req("4", "distance_based", "500", "t.km", [factor2("T", "0.1", "t.km", boundary="well_to_wheel")]))
    assert r["status"] == "computed" and r["category"] == 4


def test_category_units():
    assert calculate(req(4, "distance_based", "500", "t.km", [factor2("T", "0.1", "t.km", boundary="well_to_wheel")]))["total_co2e_kg"] == "50"
    assert calculate(req(4, "distance_based", "500000", "kg.km", [factor2("T", "0.1", "t.km", boundary="well_to_wheel")]))["total_co2e_kg"] == "50"
    assert calculate(req(5, "waste_type_specific", "2", "t", [factor2("W", "500", "t", boundary="end_of_life")]))["total_co2e_kg"] == "1000"
    assert calculate(req(6, "distance_based", "12000", "p.km", [factor2("A", "0.15", "p.km", boundary="well_to_wheel")]))["total_co2e_kg"] == "1800"
    assert calculate(req(7, "distance_based", "100", "km", [factor2("K", "0.2", "km", boundary="well_to_wheel")]))["total_co2e_kg"] == "20"
    assert calculate(req(15, "investment_specific", "1000000", "EUR", [factor2("I", "0.0002", "EUR", boundary="cradle_to_gate")]))["total_co2e_kg"] == "200"
    assert calculate(req(2, "average_data", "3", "unit", [factor2("M", "1500", "unit", boundary="cradle_to_gate")]))["total_co2e_kg"] == "4500"
    r = calculate(req(4, "distance_based", "500", "t.km", [factor2("T", "0.1", "p.km", boundary="well_to_wheel")]))
    assert codes(r) == ["UNIT_INCOMPATIBLE"]


def test_scope3_boundary_restricted():
    r = calculate(req(1, "average_data", "1", "kg", [factor2("X", "1", "kg", boundary="combustion")]))
    assert codes(r) == ["INVALID_REQUEST"] and r["blocks"][0]["field"] == "factors[0].boundary"


def test_data_quality_dims_returned_not_scored():
    dims = {"technology": "2", "geography": "3", "time": "1", "completeness": "2", "reliability": "2"}
    r = calculate(req(1, "average_data", "1000", "kg", [C2G], dims=dims))
    assert r["data_quality_dims"] == dims
    assert not any("score" in k or "puan" in k for k in r)
    r = calculate(req(1, "average_data", "1000", "kg", [C2G], dims={"technology": 2}))
    assert "INVALID_REQUEST" in codes(r)
    r = calculate(req(1, "average_data", "1000", "kg", [C2G], dims={"renk": "2"}))
    assert "INVALID_REQUEST" in codes(r)


def test_gas_factors_with_gwp_in_scope3():
    fs = [factor2("A", "1", "kg", gas="CO2", boundary="cradle_to_gate"), factor2("B", "0.01", "kg", gas="CH4", boundary="cradle_to_gate")]
    r = calculate(req(1, "average_data", "100", "kg", fs))
    assert r["coverage"] == "partial_ghg" and r["total_co2e_kg"] == "128"
