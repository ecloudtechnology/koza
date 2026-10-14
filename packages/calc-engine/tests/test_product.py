"""Ürün çalışması (§17): context=product, carbon_only, tahsis, sınır iddiası."""
import pytest

from koza_calc import calculate
from tests.conftest_v02 import activity2, codes, factor2, request2, wcodes

C2G = factor2("C2G", "2", "kg", boundary="cradle_to_gate")
G2G = factor2("G2G", "1.5", "kg", boundary="gate_to_gate")
ALLOC = {"basis": "mass", "share": "0.6", "source_ref": "x"}


def req(boundary="cradle_to_gate", factors=(C2G,), allocation=None, qty="1000", unit="kg", **pover):
    p = {"study_id": "ps-1", "boundary": boundary, "reference_flow": {"quantity": "1", "unit": "kg"}, "functional_unit": None, "allocation": allocation}
    p.update(pover)
    return request2(activity2("product_process", qty, unit, product=p), list(factors))


def test_product_context_and_carbon_only():
    r = calculate(req())
    assert r["status"] == "computed" and r["total_co2e_kg"] == "2000"
    assert r["context"] == "product" and r["scope"] is None and r["coverage"] == "carbon_only" and r["gas_coverage"] == "co2e_factor"
    assert r["claim_tr"].startswith("Ürün karbon ayak izi (beşikten kapıya)") and "Tam LCA veya EPD belgesi değildir." in r["claim_tr"]
    assert r["product"]["study_id"] == "ps-1" and r["product"]["reference_flow"] == {"quantity": "1", "unit": "kg"}
    assert r["warnings"] == []


def test_allocation_applied_and_traced():
    r = calculate(req(allocation=ALLOC))
    assert r["total_co2e_kg"] == "1200" and r["components"][0]["co2e_kg"] == "1200" and r["components"][0]["mass_kg"] == "1200"
    step = [t for t in r["trace"] if t["step"] == "allocation"][0]
    assert step == {"step": "allocation", "basis": "mass", "share": "0.6", "formula": "2000 × 0.6 = 1200 kg CO2e", "source": "x"}
    assert r["product"]["allocation"] == {"basis": "mass", "share": "0.6", "source_ref": "x"}
    r = calculate(req(allocation={"basis": "none", "share": None, "source_ref": None}))
    assert r["total_co2e_kg"] == "2000" and not any(t["step"] == "allocation" for t in r["trace"])


@pytest.mark.parametrize("alloc", [
    {"basis": "economic", "share": "1.5", "source_ref": "x"},
    {"basis": "economic", "share": "-0.1", "source_ref": "x"},
    {"basis": "mass", "share": "0.5", "source_ref": ""},
    {"basis": "random", "share": "0.5", "source_ref": "x"},
    {"basis": "none", "share": "0.5", "source_ref": "x"},
    "0.5",
])
def test_allocation_invalid(alloc):
    assert "ALLOCATION_INVALID" in codes(calculate(req(allocation=alloc)))


def test_share_bounds_inclusive():
    assert calculate(req(allocation=dict(ALLOC, share="1")))["total_co2e_kg"] == "2000"
    assert calculate(req(allocation=dict(ALLOC, share="0")))["total_co2e_kg"] == "0"


def test_gate_to_gate_is_partial_claim():
    r = calculate(req(boundary="gate_to_gate", factors=[G2G]))
    assert r["status"] == "computed" and r["total_co2e_kg"] == "1500"
    assert r["claim_tr"].startswith("Kısmi ürün karbon ayak izi (kapıdan kapıya)")
    assert wcodes(r) == ["PARTIAL_BOUNDARY"]


def test_study_boundary_does_not_change_factor_boundary():
    r = calculate(req(boundary="cradle_to_grave", factors=[C2G]))
    assert r["status"] == "review_required" and r["boundary"] == "cradle_to_gate" and r["product"]["boundary"] == "cradle_to_grave"
    assert wcodes(r) == ["PARTIAL_BOUNDARY"] and "faktörün gerçek sınırı" in r["warnings"][0]["message_tr"]
    r = calculate(req(boundary="custom", factors=[G2G]))
    assert r["status"] == "computed" and wcodes(r) == ["PARTIAL_BOUNDARY"]


def test_cradle_to_grave_allowed_in_product_study():
    r = calculate(req(boundary="cradle_to_grave", factors=[factor2("LCA", "3", "kg", boundary="cradle_to_grave")]))
    assert r["status"] == "computed" and r["total_co2e_kg"] == "3000" and "beşikten mezara" in r["claim_tr"]


def test_structural_and_reference_flow():
    rq = req()
    rq["activity"]["product"] = None
    assert codes(calculate(rq)) == ["INVALID_REQUEST"]
    assert "INVALID_REQUEST" in codes(calculate(req(boundary="cradle_to_cradle")))
    assert "INVALID_REQUEST" in codes(calculate(req(study_id="")))
    assert "INVALID_REQUEST" in codes(calculate(req(reference_flow=None)))
    assert "INVALID_NUMBER" in codes(calculate(req(reference_flow={"quantity": "0", "unit": "kg"})))
    assert "UNIT_UNKNOWN" in codes(calculate(req(reference_flow={"quantity": "1", "unit": "adet"})))


def test_gas_factors_and_boundary_mix_in_product():
    fs = [factor2("A", "1", "kg", gas="CO2", boundary="cradle_to_gate"), factor2("B", "0.01", "kg", gas="CH4", boundary="cradle_to_gate")]
    r = calculate(req(factors=fs))
    assert r["gas_coverage"] == "partial_ghg" and r["coverage"] == "carbon_only" and r["total_co2e_kg"] == "1280"
    assert "BOUNDARY_MIX" in codes(calculate(req(factors=[C2G, factor2("U", "1", "kg", gas="CO2", boundary="upstream")])))


def test_blocked_product_keeps_context():
    r = calculate(req(qty="-5"))
    assert r["status"] == "blocked" and r["context"] == "product" and r["scope"] is None
