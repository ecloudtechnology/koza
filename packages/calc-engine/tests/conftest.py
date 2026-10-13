import copy
from pathlib import Path

import pytest

PACKAGE_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = PACKAGE_DIR.parents[1]
GOLDEN_DIR = REPO_ROOT / "tests" / "golden"

SRC = "tests — kurgusal"


def make_activity(**over):
    a = {
        "id": "act-unit-0001",
        "version": 2,
        "source_type": "stationary_combustion",
        "fuel": "natural_gas",
        "quantity": "100",
        "unit": "GJ",
        "heating_value_basis": "LHV",
        "reference_conditions": None,
        "calorific_value": None,
        "basis_conversion": None,
        "data_quality": "measured",
        "period": {"start": "2026-01-01", "end": "2026-01-31"},
    }
    a.update(over)
    return a


def make_factor(id="TEST-NG-CO2", gas="CO2", value="50", den="GJ", basis="LHV", num="kg", boundary="combustion", **over):
    f = {
        "id": id,
        "version": "1.0",
        "value": value,
        "numerator_unit": num,
        "gas": gas,
        "denominator_unit": den,
        "basis": basis,
        "reference_conditions": None,
        "boundary": boundary,
        "gwp_set_id": None,
        "source_ref": SRC,
        "license": "test-only",
        "valid_from": "2026-01-01",
        "valid_to": None,
    }
    f.update(over)
    return f


METHOD = {"id": "ghgp-corporate-test", "version": "0.1", "gwp_set": {"id": "TEST-GWP", "CH4": "28", "N2O": "265"}}


def make_request(activity=None, factors=None, method=None):
    return {
        "activity": activity if activity is not None else make_activity(),
        "factors": copy.deepcopy(factors) if factors is not None else [make_factor()],
        "method": copy.deepcopy(method) if method is not None else copy.deepcopy(METHOD),
    }


@pytest.fixture
def base_request():
    return make_request()
