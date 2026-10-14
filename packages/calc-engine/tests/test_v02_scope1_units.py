"""0.2: yeni birimler, hareketli yanma, proses, dışa aktarımlar."""
import json
import re
from decimal import Decimal, localcontext
from pathlib import Path

import pytest

from koza_calc import ENGINE_VERSION, SUPPORTED, aggregate, calculate
from koza_calc import units as U
from koza_calc.errors import ALL_CODES, ALL_WARNING_CODES, MESSAGES_TR, WARNINGS_TR, warning
from koza_calc.numbers import CONTEXT, format_decimal
from tests.conftest_v02 import activity2, codes, factor2, request2

NEW_BLOCKS = ["REFRIGERANT_GAS_UNKNOWN", "EQUIPMENT_NOT_IN_INVENTORY", "INSTRUMENT_EXCEEDS_CONSUMPTION", "INSTRUMENT_DUPLICATE",
              "CURRENCY_MISMATCH", "NA_REASON_REQUIRED", "DATA_MISSING", "LCA_FACTOR_IN_CATEGORY", "BOUNDARY_OVERLAP",
              "METHOD_NOT_ALLOWED", "DEFAULT_SCENARIO_FORBIDDEN", "ALLOCATION_INVALID", "PROCESS_ID_REQUIRED", "DENSITY_REQUIRED"]
NEW_WARNINGS = ["REFRIGERANT_TOPUP_ASSUMPTION", "RECOVERED_NOT_EMISSION", "RESIDUAL_MIX_UNAVAILABLE", "INSTRUMENT_NOT_ELIGIBLE",
                "UPSTREAM_MISSING", "SPEND_BASED_ESTIMATE", "PARTIAL_BOUNDARY"]


def test_exports_and_version():
    assert ENGINE_VERSION == "0.2.0"
    assert callable(calculate) and callable(aggregate)
    assert isinstance(SUPPORTED, dict)


def test_new_codes_have_turkish_messages():
    for code in NEW_BLOCKS:
        assert code in ALL_CODES and MESSAGES_TR[code].strip()
    for code in NEW_WARNINGS:
        assert code in ALL_WARNING_CODES and WARNINGS_TR[code].strip()
        assert warning(code)["message_tr"] == WARNINGS_TR[code]
    with pytest.raises(KeyError):
        warning("YOK")


def test_new_unit_families():
    assert U.unit_family("L") == U.VOLUME_LIQUID and U.unit_family("m3_liquid") == U.VOLUME_LIQUID
    assert U.unit_family("km") == U.DISTANCE
    assert U.unit_family("t.km") == U.MASS_DISTANCE and U.unit_family("kg.km") == U.MASS_DISTANCE
    assert U.unit_family("p.km") == U.PASSENGER_DISTANCE
    assert U.unit_family("unit") == U.COUNT
    for c in ("TRY", "EUR", "USD"):
        assert U.unit_family(c) == U.CURRENCY and U.is_currency(c)
    assert U.unit_family("m3") == U.VOLUME  # gaz hacmi sıvıyla karışmaz
    assert U.unit_family("l") is None


def test_same_family_conversions():
    with localcontext(CONTEXT):
        assert U.convert_liquid(Decimal("2"), "m3_liquid", "L") == (Decimal("2000"), Decimal("1000"))
        assert U.convert_mass_distance(Decimal("500"), "t.km", "kg.km")[0] == Decimal("500000")
        assert U.convert_same_family(Decimal("7"), "km", "km") == (Decimal("7"), Decimal("1"))
        assert U.convert_same_family(Decimal("7"), "TRY", "TRY")[0] == Decimal("7")
        with pytest.raises(ValueError):
            U.convert_same_family(Decimal("7"), "TRY", "EUR")
        with pytest.raises(ValueError):
            U.convert_same_family(Decimal("7"), "km", "kg")
        assert U.liquid_to_mass(Decimal("1000"), Decimal("0.85")) == Decimal("850")
        assert U.mass_to_liquid(Decimal("850"), Decimal("0.85")) == Decimal("1000")


# --- hareketli yanma ---

DIESEL_L = factor2("TEST-DIESEL-L", "2.7", "L", boundary="combustion")


def test_mobile_litre_times_factor():
    r = calculate(request2(activity2("mobile_combustion", "1000", "L", fuel="diesel", vehicle_class="hdv"), [DIESEL_L]))
    assert r["status"] == "computed" and r["total_co2e_kg"] == "2700"
    assert r["scope"] == 1 and r["context"] == "corporate" and r["value_state"] == "known"
    assert r["vehicle_class"] == "hdv" and r["source_type"] == "mobile_combustion"
    assert r["normalized_activity"] == {"quantity": "1000", "unit": "L", "basis": None}


def test_mobile_m3_liquid_to_litre():
    r = calculate(request2(activity2("mobile_combustion", "1", "m3_liquid", fuel="gasoline"), [DIESEL_L]))
    assert r["total_co2e_kg"] == "2700"
    assert r["trace"][1]["ratio"] == "1000"


def test_mobile_kg_requires_density_then_converts():
    r = calculate(request2(activity2("mobile_combustion", "850", "kg", fuel="diesel"), [DIESEL_L]))
    assert codes(r) == ["DENSITY_REQUIRED"]
    dens = {"value": "0.85", "unit": "kg/L", "source_ref": "x"}
    r = calculate(request2(activity2("mobile_combustion", "850", "kg", fuel="diesel", density=dens), [DIESEL_L]))
    assert r["total_co2e_kg"] == "2700"
    conv = [t for t in r["trace"] if t["step"] == "unit_conversion"][0]
    assert conv["from"] == "850 kg" and conv["to"] == "1000 L" and "density 0.85 kg/L" in conv["source"]
    # ters yön: L → kg faktörü
    r = calculate(request2(activity2("mobile_combustion", "1000", "L", fuel="diesel", density=dens), [factor2("F-KG", "3.2", "kg", boundary="combustion")]))
    assert r["total_co2e_kg"] == "2720"


@pytest.mark.parametrize("dens, field", [
    ({"value": "0.85", "unit": "g/mL", "source_ref": "x"}, "activity.density.unit"),
    ({"value": "0.85", "unit": "kg/L", "source_ref": ""}, "activity.density.source_ref"),
])
def test_density_must_be_kg_per_l_and_sourced(dens, field):
    r = calculate(request2(activity2("mobile_combustion", "850", "kg", fuel="diesel", density=dens), [DIESEL_L]))
    assert "DENSITY_REQUIRED" in codes(r)
    assert any(b["field"] == field for b in r["blocks"])


def test_mobile_energy_unit_still_works_and_unknown_fuel_blocks():
    r = calculate(request2(activity2("mobile_combustion", "100", "GJ", fuel="natural_gas", heating_value_basis="LHV"),
                           [factor2("F", "50", "GJ", gas="CO2", boundary="combustion", basis="LHV")]))
    assert r["total_co2e_kg"] == "5000"
    r = calculate(request2(activity2("mobile_combustion", "100", "L", fuel="jet"), [DIESEL_L]))
    assert codes(r) == ["INVALID_REQUEST"] and r["blocks"][0]["field"] == "activity.fuel"
    r = calculate(request2(activity2("mobile_combustion", "100", "km", fuel="diesel"), [DIESEL_L]))
    assert "UNIT_INCOMPATIBLE" in codes(r)


def test_liquid_to_energy_unsupported():
    r = calculate(request2(activity2("mobile_combustion", "100", "L", fuel="diesel"), [factor2("F", "70", "GJ", boundary="combustion")]))
    assert codes(r) == ["UNIT_INCOMPATIBLE"]


# --- proses ---

CEMENT = factor2("TEST-CLINKER", "500", "t", gas="CO2", boundary="process")


def test_process_tonnes_times_factor():
    r = calculate(request2(activity2("process", "100", "t", process_id="kiln-1"), [CEMENT]))
    assert r["status"] == "computed" and r["total_co2e_kg"] == "50000" and r["coverage"] == "co2_only"
    assert r["process_id"] == "kiln-1" and r["boundary"] == "process"
    r = calculate(request2(activity2("process", "100000", "kg", process_id="kiln-1"), [CEMENT]))
    assert r["total_co2e_kg"] == "50000"


def test_process_id_required_and_mass_unit():
    assert codes(calculate(request2(activity2("process", "100", "t"), [CEMENT]))) == ["PROCESS_ID_REQUIRED"]
    assert codes(calculate(request2(activity2("process", "100", "t", process_id="  "), [CEMENT]))) == ["PROCESS_ID_REQUIRED"]
    assert "UNIT_INCOMPATIBLE" in codes(calculate(request2(activity2("process", "100", "GJ", process_id="k"), [CEMENT])))


def test_unknown_source_type_lists_supported():
    r = calculate(request2(activity2("bilinmeyen", "1", "kg"), [CEMENT]))
    assert codes(r) == ["UNSUPPORTED_SOURCE_TYPE"]
    assert "scope3" in r["blocks"][0]["message_tr"]


def test_stationary_response_gains_context_fields_only_additively():
    from tests.conftest import make_request
    r = calculate(make_request())
    assert r["context"] == "corporate" and r["scope"] == 1 and r["value_state"] == "known"
    assert r["source_type"] == "stationary_combustion"


def _check_json_types(value, path="$"):
    if isinstance(value, dict):
        for k, v in value.items():
            assert isinstance(k, str), path
            _check_json_types(v, f"{path}.{k}")
    elif isinstance(value, list):
        for i, v in enumerate(value):
            _check_json_types(v, f"{path}[{i}]")
    else:
        assert value is None or isinstance(value, (str, bool, int)), f"{path}: {type(value)}"
        assert not isinstance(value, float), path


def test_all_golden_outputs_json_plain_types():
    golden = Path(__file__).resolve().parents[3] / "tests" / "golden"
    for p in sorted(golden.glob("*.json")):
        fx = json.loads(p.read_text(encoding="utf-8"))
        r = aggregate(fx["aggregate_request"]) if "aggregate_request" in fx else calculate(fx["request"])
        _check_json_types(r)
        assert json.loads(json.dumps(r, ensure_ascii=False)) == r, p.name
        assert not re.search(r'"-?\d+(\.\d+)?[eE][+-]?\d+"', json.dumps(r)), p.name  # üstel gösterim yok


def test_no_float_and_stdlib_only_in_new_modules():
    pkg = Path(__file__).resolve().parents[1] / "koza_calc"
    allowed = {"decimal", "hashlib", "json", "re", "os", "__future__"}
    for py in sorted(pkg.glob("*.py")):
        text = py.read_text(encoding="utf-8")
        assert not re.search(r"\bfloat\s*\(", text), py.name
        for line in text.splitlines():
            m = re.match(r"^\s*(?:from\s+(\S+)\s+import|import\s+(\S+))", line)
            if m:
                mod = (m.group(1) or m.group(2)).split(".")[0]
                assert mod == "" or mod.startswith(".") or mod in allowed, f"{py.name}: {line.strip()}"
