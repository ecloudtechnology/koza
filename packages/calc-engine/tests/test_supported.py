"""SUPPORTED matrisi (§30) ve altın set koşucusunun aggregate dağıtımı."""
import json

from koza_calc import SUPPORTED
from koza_calc.golden import run_fixture
from koza_calc.supported import scope3_methods

EXPECTED = {
    "stationary_combustion": ["activity_x_factor"],
    "mobile_combustion": ["fuel_based"],
    "process": ["activity_x_factor"],
    "refrigerant": ["mass_balance"],
    "purchased_electricity": ["location_based", "market_based"],
    "purchased_steam": ["location_based", "market_based"],
    "purchased_heat": ["location_based", "market_based"],
    "purchased_cooling": ["location_based", "market_based"],
    "scope3": {
        "1": ["supplier_specific", "hybrid", "average_data", "spend_based"],
        "2": ["supplier_specific", "hybrid", "average_data", "spend_based"],
        "3": ["average_data"],
        "4": ["distance_based", "fuel_based", "spend_based"],
        "5": ["waste_type_specific", "average_data"],
        "6": ["distance_based", "spend_based"],
        "7": ["distance_based", "average_data"],
        "8": ["average_data"],
        "9": ["distance_based"],
        "10": ["average_data"],
        "11": ["lifetime_use"],
        "12": ["waste_type_specific"],
        "13": ["average_data"],
        "14": ["average_data"],
        "15": ["investment_specific"],
    },
    "product_process": ["activity_x_factor"],
}


def test_supported_matrix_exact():
    assert SUPPORTED == EXPECTED
    assert json.loads(json.dumps(SUPPORTED)) == SUPPORTED
    assert scope3_methods(11) == ["lifetime_use"] and scope3_methods(99) == []


def test_golden_runner_dispatches_aggregate():
    fx = {"id": "agg", "expected": {"status": "computed", "corporate": {"total_kg": "5", "scope2_alternative_kg": None}},
          "aggregate_request": {"results": [{"record_id": "a", "context": "corporate", "scope": 1, "category": None, "state": "approved",
                                             "result": {"status": "computed", "total_co2e_kg": "5", "value_state": "known"}, "scope2_method_used": None}],
                                "policy": {"include_states": ["approved"]}}}
    assert run_fixture(fx) == {"id": "agg", "ok": True, "diff": []}
    fx["expected"]["corporate"]["total_kg"] = "6"
    assert run_fixture(fx)["diff"] == ["corporate.total_kg: beklenen \"6\", gelen \"5\""]
    assert run_fixture({"id": "x", "expected": {}})["ok"] is False
