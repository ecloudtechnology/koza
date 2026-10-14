"""Soğutucu kaçak emisyonu (T11, §12 kritik istisnalar ve kabul koşulları)."""
import pytest

from koza_calc import calculate
from tests.conftest_v02 import METHOD2, activity2, codes, factor2, request2, wcodes

R134A = factor2("GWP-R134A", "1000", "kg", gas="R-134a", boundary="fugitive")


def req(gas="R-134a", charge="leak_measured", qty="10", unit="kg", in_inv=True, factors=(R134A,), method=None):
    act = activity2("refrigerant", qty, unit, refrigerant={"gas": gas, "charge_type": charge, "equipment_in_inventory": in_inv})
    return request2(act, list(factors), method)


def test_t11_new_fill_not_applicable_not_zero():
    r = calculate(req(charge="new_equipment_fill"))
    assert r["status"] == "computed" and r["total_co2e_kg"] is None and r["coverage"] is None
    assert r["components"] == [] and r["value_state"] == "not_applicable" and r["blocks"] == []
    assert r["claim_tr"] == "Yeni ekipman dolumu sızıntı değildir; emisyon sayılmaz."
    assert r["boundary"] == "fugitive" and r["scope"] == 1
    assert r["refrigerant"] == {"gas": "R-134a", "charge_type": "new_equipment_fill", "equipment_in_inventory": True}


def test_t11_topup_counts_with_review():
    r = calculate(req(charge="top_up"))
    assert r["status"] == "review_required" and r["total_co2e_kg"] == "10000"
    assert wcodes(r) == ["REFRIGERANT_TOPUP_ASSUMPTION"] and r["coverage"] == "full_ghg"
    c = r["components"][0]
    assert c == {"gas": "R-134a", "factor_id": "GWP-R134A", "factor_version": "1.0", "mass_kg": "10", "gwp": "1000", "gwp_applied": True, "co2e_kg": "10000"}


def test_leak_measured_computed_and_gwp_from_method_set():
    r = calculate(req(gas="R-410A", qty="5", factors=[]))
    assert r["status"] == "computed" and r["total_co2e_kg"] == "10000" and r["warnings"] == []
    assert r["components"][0]["factor_id"] is None and r["components"][0]["gwp"] == "2000"
    gwp = [t for t in r["trace"] if t["step"] == "gwp"][0]
    assert gwp["gwp_set_id"] == "TEST-GWP" and gwp["formula"] == "5 × 2000 = 10000 kg CO2e"


def test_factor_takes_precedence_over_gwp_set():
    f = factor2("GWP-R410A", "1900", "kg", gas="R-410A", boundary="fugitive")
    r = calculate(req(gas="R-410A", qty="5", factors=[f]))
    assert r["total_co2e_kg"] == "9500"


def test_recovered_not_applicable_with_warning():
    r = calculate(req(charge="recovered"))
    assert r["status"] == "computed" and r["value_state"] == "not_applicable" and r["total_co2e_kg"] is None
    assert wcodes(r) == ["RECOVERED_NOT_EMISSION"]


def test_gas_unknown_blocks():
    r = calculate(req(gas="unknown", factors=[]))
    assert codes(r) == ["REFRIGERANT_GAS_UNKNOWN"]
    # yeni dolum bile olsa gaz bilinmiyorsa hesap bekler
    assert codes(calculate(req(gas="unknown", charge="new_equipment_fill", factors=[]))) == ["REFRIGERANT_GAS_UNKNOWN"]


def test_equipment_not_in_inventory_blocks():
    r = calculate(req(in_inv=False))
    assert codes(r) == ["EQUIPMENT_NOT_IN_INVENTORY"]
    r = calculate(req(in_inv=None))
    assert codes(r) == ["INVALID_REQUEST"]


def test_blend_without_gwp_blocks():
    r = calculate(req(gas="R-407C", factors=[]))
    assert codes(r) == ["GWP_MISSING"] and r["blocks"][0]["field"] == "method.gwp_set.R-407C"


def test_disposal_rule_undefined_blocks():
    assert codes(calculate(req(charge="disposal"))) == ["METHOD_NOT_ALLOWED"]


def test_factor_gas_must_match_and_be_fugitive_kg_per_kg():
    r = calculate(req(factors=[factor2("X", "1000", "kg", gas="R-410A", boundary="fugitive")]))
    assert codes(r) == ["INVALID_REQUEST"] and r["blocks"][0]["field"] == "factors[0].gas"
    r = calculate(req(factors=[factor2("X", "1000", "kg", gas="R-134a", boundary="combustion")]))
    assert codes(r) == ["INVALID_REQUEST"] and r["blocks"][0]["field"] == "factors[0].boundary"
    r = calculate(req(factors=[factor2("X", "1000", "GJ", gas="R-134a", boundary="fugitive")]))
    assert "UNIT_INCOMPATIBLE" in codes(r)
    r = calculate(req(factors=[R134A, R134A]))
    assert codes(r) == ["FACTOR_DUPLICATE_GAS"]


def test_tonne_quantity_and_tonne_factor_units():
    r = calculate(req(qty="0.01", unit="t"))
    assert r["total_co2e_kg"] == "10000" and r["normalized_activity"] == {"quantity": "10", "unit": "kg", "basis": None}
    r = calculate(req(factors=[factor2("T", "1", "kg", num="t", gas="R-134a", boundary="fugitive")]))
    assert r["components"][0]["gwp"] == "1000"
    r = calculate(req(factors=[factor2("T", "1000000", "t", gas="R-134a", boundary="fugitive")]))
    assert r["components"][0]["gwp"] == "1000"


def test_quantity_must_be_mass_and_nonnegative():
    assert "UNIT_INCOMPATIBLE" in codes(calculate(req(unit="L")))
    assert codes(calculate(req(qty="-1"))) == ["NEGATIVE_QUANTITY"]


@pytest.mark.parametrize("missing", ["gas", "charge_type"])
def test_structural(missing):
    rq = req()
    rq["activity"]["refrigerant"][missing] = None
    assert "INVALID_REQUEST" in codes(calculate(rq))
    rq["activity"]["refrigerant"] = None
    assert "INVALID_REQUEST" in codes(calculate(rq))


def test_estimated_quality_still_review():
    rq = req()
    rq["activity"]["data_quality"] = "estimated"
    r = calculate(rq)
    assert r["status"] == "review_required" and wcodes(r) == ["DATA_QUALITY_ESTIMATED"]
    assert METHOD2["gwp_set"]["R-410A"] == "2000"
