"""0.2 testleri için ortak yapıcılar (kurgusal katsayılar, kural 12)."""
import copy

from tests.conftest import SRC

METHOD2 = {"id": "ghgp-corporate-test", "version": "0.2",
           "gwp_set": {"id": "TEST-GWP", "CH4": "28", "N2O": "265", "R-410A": "2000"}}
PERIOD = {"start": "2026-01-01", "end": "2026-12-31"}


def factor2(id="F", value="1", den="kg", gas="CO2e", num="kg", boundary="cradle_to_gate", basis=None, **over):
    f = {"id": id, "version": "1.0", "value": value, "numerator_unit": num, "gas": gas, "denominator_unit": den,
         "basis": basis, "reference_conditions": None, "boundary": boundary, "gwp_set_id": None,
         "source_ref": SRC, "license": "test-only", "valid_from": "2026-01-01", "valid_to": None}
    f.update(over)
    return f


def activity2(source_type, quantity, unit, **over):
    a = {"id": "act-v02", "version": 1, "source_type": source_type, "fuel": None, "quantity": quantity, "unit": unit,
         "heating_value_basis": None, "reference_conditions": None, "calorific_value": None, "basis_conversion": None,
         "data_quality": "measured", "period": PERIOD}
    a.update(over)
    return a


def request2(activity, factors, method=None):
    return {"activity": activity, "factors": copy.deepcopy(factors), "method": copy.deepcopy(method or METHOD2)}


def codes(r):
    return sorted(b["code"] for b in r["blocks"])


def wcodes(r):
    return sorted(w["code"] for w in r["warnings"])
