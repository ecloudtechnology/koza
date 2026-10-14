"""Kapsam 2 (T05, T06, §13): konum + piyasa bazlı, araçlar, artık karışım."""
import copy

import pytest

from koza_calc import calculate
from tests.conftest_v02 import PERIOD, activity2, codes, factor2, request2, wcodes

LOC = factor2("LOC", "0.4", "kWh", boundary="combustion", role="location")
RES = factor2("RES", "0.5", "kWh", boundary="combustion", role="market_residual")


def go(id="GO-1", mwh="60", retired=True, quality=True, value="0"):
    return {"id": id, "type": "guarantee_of_origin", "mwh": mwh, "generation_period": PERIOD, "retired": retired,
            "quality_criteria_met": quality, "beneficiary": "org-x", "factor": factor2("GO-F-" + id, value, "kWh", boundary="combustion")}


def req(method="both", instruments=(), factors=(LOC, RES), residual=None, quantity="100", unit="MWh", source_type="purchased_electricity", **s2over):
    s2 = {"method": method, "grid_region": "TR", "instruments": list(instruments), "residual_mix_factor": residual,
          "self_generation_mwh": "0", "sold_to_grid_mwh": "0"}
    s2.update(s2over)
    return request2(activity2(source_type, quantity, unit, scope2=s2), list(factors))


def test_t05_two_methods_not_summed():
    r = calculate(req(instruments=[go()]))
    assert r["status"] == "computed" and r["total_co2e_kg"] is None and r["coverage"] is None
    assert r["scope"] == 2 and r["components"] == []
    assert r["primary_method"] == "location_based" and r["scope2_method"] == "both"
    assert r["results"]["location_based"]["total_co2e_kg"] == "40000"
    assert r["results"]["market_based"]["total_co2e_kg"] == "20000"
    mb = r["results"]["market_based"]
    assert mb["covered_mwh"] == "60" and mb["uncovered_mwh"] == "40" and mb["instrument_ids"] == ["GO-1"]
    assert [c["portion_mwh"] for c in mb["components"]] == ["60", "40"]
    assert "toplanmaz" in r["claim_tr"]
    steps = [t for t in r["trace"] if t["step"] == "scope2_method"]
    assert [(s["method"], s["primary"]) for s in steps] == [("location_based", True), ("market_based", False)]


def test_only_requested_method_returned():
    r = calculate(req(method="location_based", factors=[LOC]))
    assert list(r["results"]) == ["location_based"] and r["primary_method"] == "location_based"
    r = calculate(req(method="market_based", instruments=[go()], factors=[LOC], residual=RES))
    assert list(r["results"]) == ["market_based"] and r["results"]["market_based"]["total_co2e_kg"] == "20000"


def test_t06_residual_unavailable_uses_location_with_review():
    r = calculate(req(method="market_based", instruments=[go()], factors=[LOC]))
    assert r["status"] == "review_required" and wcodes(r) == ["RESIDUAL_MIX_UNAVAILABLE"]
    mb = r["results"]["market_based"]
    assert mb["total_co2e_kg"] == "16000" and mb["residual_factor_used"] == "location_fallback"
    assert r["warnings"][0]["method"] == "market_based"


def test_t06b_instrument_exceeds_consumption_blocks():
    r = calculate(req(method="market_based", instruments=[go(mwh="120")]))
    assert codes(r) == ["INSTRUMENT_EXCEEDS_CONSUMPTION"] and r["results"] is None
    # tam eşit → kabul, kalan 0, artık karışım gerekmez
    r = calculate(req(method="market_based", instruments=[go(mwh="100")], factors=[LOC]))
    assert r["status"] == "computed" and r["results"]["market_based"]["total_co2e_kg"] == "0"
    assert r["results"]["market_based"]["uncovered_mwh"] == "0" and r["results"]["market_based"]["residual_factor_used"] == "none"


def test_ineligible_instrument_not_counted():
    for kw in ({"retired": False}, {"quality": False}):
        r = calculate(req(method="market_based", instruments=[go(**kw)]))
        assert r["status"] == "computed" and wcodes(r) == ["INSTRUMENT_NOT_ELIGIBLE"]
        mb = r["results"]["market_based"]
        assert mb["total_co2e_kg"] == "50000" and mb["covered_mwh"] == "0" and mb["ineligible_instrument_ids"] == ["GO-1"]
    # uygun olmayan 150 MWh araç tüketimi aşsa da bloke etmez (sayılmıyor)
    r = calculate(req(method="market_based", instruments=[go(mwh="150", retired=False)]))
    assert r["status"] == "computed"


def test_duplicate_instrument_blocks():
    r = calculate(req(method="market_based", instruments=[go(), go(mwh="10")]))
    assert codes(r) == ["INSTRUMENT_DUPLICATE"]


def test_instrument_with_nonzero_factor_and_multiple_instruments():
    ins = [go("A", "30", value="0.1"), go("B", "20", value="0")]
    r = calculate(req(method="market_based", instruments=ins))
    mb = r["results"]["market_based"]
    # 30 MWh × 0.1 kg/kWh = 3000; B 0; kalan 50 MWh × 0.5 = 25000
    assert mb["total_co2e_kg"] == "28000" and mb["instrument_ids"] == ["A", "B"]
    assert [c["instrument_id"] for c in mb["components"]] == ["A", "B", None]


def test_sold_to_grid_not_deducted_only_traced():
    r = calculate(req(method="location_based", factors=[LOC], sold_to_grid_mwh="30", self_generation_mwh="10"))
    assert r["results"]["location_based"]["total_co2e_kg"] == "40000"
    sg = [t for t in r["trace"] if t["step"] == "self_generation"][0]
    assert sg["sold_to_grid_mwh"] == "30" and sg["self_generation_mwh"] == "10"


def test_kwh_consumption_and_normalization():
    r = calculate(req(method="location_based", factors=[LOC], quantity="250000", unit="kWh"))
    assert r["normalized_activity"] == {"quantity": "250", "unit": "MWh", "basis": None}
    assert r["results"]["location_based"]["total_co2e_kg"] == "100000"


def test_factor_role_required_and_location_missing():
    r = calculate(req(method="location_based", factors=[factor2("X", "0.4", "kWh", boundary="combustion")]))
    assert codes(r) == ["INVALID_REQUEST"] and r["blocks"][0]["field"] == "factors[0].role"
    r = calculate(req(method="location_based", factors=[RES]))
    assert codes(r) == ["INVALID_REQUEST"] and "location" in r["blocks"][0]["message_tr"]
    r = calculate(req(method="market_based", factors=[]))
    assert codes(r) == ["INVALID_REQUEST"]  # kalan için faktör yok


def test_mixed_co2e_and_gas_across_portions_blocks():
    ins = [go("A", "60", value="0")]
    ins[0]["factor"]["gas"] = "CO2"
    r = calculate(req(method="market_based", instruments=ins))
    assert codes(r) == ["FACTOR_MIX_CO2E_AND_GAS"]


def test_structural_errors():
    r = calculate(request2(activity2("purchased_electricity", "100", "MWh"), [LOC]))
    assert codes(r) == ["INVALID_REQUEST"] and r["blocks"][0]["field"] == "activity.scope2"
    r = calculate(req(method="hibrit", factors=[LOC]))
    assert codes(r) == ["INVALID_REQUEST"]
    r = calculate(req(method="location_based", factors=[LOC], quantity="100", unit="kg"))
    assert "UNIT_INCOMPATIBLE" in codes(r)
    bad = go()
    bad["retired"] = "evet"
    r = calculate(req(method="market_based", instruments=[bad]))
    assert "INVALID_REQUEST" in codes(r)
    bad = go()
    bad["factor"] = None
    r = calculate(req(method="market_based", instruments=[bad]))
    assert "INVALID_REQUEST" in codes(r)


@pytest.mark.parametrize("st", ["purchased_steam", "purchased_heat", "purchased_cooling"])
def test_other_scope2_sources_use_energy_factor(st):
    f = factor2("STEAM", "60", "GJ", boundary="combustion", role="location")
    r = calculate(req(method="location_based", factors=[f], quantity="10", unit="GJ", source_type=st))
    assert r["status"] == "computed" and r["results"]["location_based"]["total_co2e_kg"] == "600"
    assert r["source_type"] == st and r["scope"] == 2


def test_estimated_data_quality_review_in_both_methods():
    rq = req(instruments=[go()])
    rq["activity"]["data_quality"] = "estimated"
    r = calculate(rq)
    assert r["status"] == "review_required"
    assert [w["method"] for w in r["warnings"]] == ["location_based", "market_based"]


def test_deterministic_and_no_mutation():
    rq = req(instruments=[go()])
    snap = copy.deepcopy(rq)
    a, b = calculate(rq), calculate(copy.deepcopy(rq))
    assert a == b and rq == snap
