import copy
import json
import re
from pathlib import Path

import pytest

from koza_calc import ENGINE_VERSION, calculate
from koza_calc.errors import ALL_CODES, MESSAGES_TR
from tests.conftest import METHOD, make_activity, make_factor, make_request

CONTRACT_CODES = [
    "INVALID_NUMBER", "NEGATIVE_QUANTITY", "UNIT_UNKNOWN", "UNIT_INCOMPATIBLE", "UNIT_CONDITIONS_UNKNOWN",
    "CALORIFIC_VALUE_REQUIRED", "BASIS_UNKNOWN", "BASIS_MISMATCH", "FACTOR_MISSING_SOURCE", "FACTOR_UNIT_MISSING",
    "FACTOR_DUPLICATE_GAS", "FACTOR_MIX_CO2E_AND_GAS", "GWP_MISSING", "BOUNDARY_MIX", "DIVISION_BY_ZERO",
    "UNSUPPORTED_SOURCE_TYPE",
]


def codes(result):
    return [b["code"] for b in result["blocks"]]


def test_engine_version_exported():
    assert ENGINE_VERSION == "0.1.0"
    assert calculate(make_request())["engine_version"] == "0.1.0"


def test_all_contract_codes_have_turkish_messages():
    for code in CONTRACT_CODES:
        assert code in ALL_CODES
        assert MESSAGES_TR[code].strip()


def test_t01_shape_matches_contract(base_request):
    r = calculate(base_request)
    assert r["status"] == "computed"
    assert r["blocks"] == [] and r["warnings"] == []
    assert r["normalized_activity"] == {"quantity": "100", "unit": "GJ", "basis": "LHV"}
    assert r["components"] == [
        {"gas": "CO2", "factor_id": "TEST-NG-CO2", "factor_version": "1.0", "mass_kg": "5000", "gwp": None, "gwp_applied": False, "co2e_kg": "5000"}
    ]
    assert r["total_co2e_kg"] == "5000"
    assert r["coverage"] == "co2_only"
    assert r["claim_tr"] == "Yalnız CO₂ bileşeni; tam CO₂e sonucu değildir."
    assert r["boundary"] == "combustion"
    assert r["method"] == {"id": "ghgp-corporate-test", "version": "0.1"}
    steps = [t["step"] for t in r["trace"]]
    assert steps == ["validate_input", "unit_conversion", "factor_match", "gas_calculation", "gwp", "result"]
    assert r["trace"][1] == {"step": "unit_conversion", "from": "100 GJ", "to": "100 GJ", "ratio": "1", "source": "sabit tablo"}
    assert r["trace"][2]["basis_check"] == "LHV=LHV"
    assert r["trace"][3]["formula"] == "100 × 50 = 5000 kg"
    assert r["trace"][4]["applied"] is False
    assert r["inputs_hash"].startswith("sha256:") and len(r["inputs_hash"]) == len("sha256:") + 64


def test_blocked_shape(base_request):
    base_request["activity"]["quantity"] = "-1"
    r = calculate(base_request)
    assert r["status"] == "blocked"
    assert codes(r) == ["NEGATIVE_QUANTITY"]
    assert r["blocks"][0]["field"] == "activity.quantity"
    assert r["blocks"][0]["message_tr"]
    assert r["components"] == [] and r["total_co2e_kg"] is None and r["coverage"] is None
    assert r["normalized_activity"] is None
    assert r["trace"][0] == {"step": "validate_input", "ok": False, "activity_id": "act-unit-0001", "activity_version": 2}


@pytest.mark.parametrize("value", [100, 100.0, True])
def test_non_string_numbers_rejected(base_request, value):
    base_request["activity"]["quantity"] = value
    r = calculate(base_request)
    assert codes(r) == ["INVALID_NUMBER"]
    assert r["blocks"][0]["field"] == "activity.quantity"


def test_factor_value_number_rejected(base_request):
    base_request["factors"][0]["value"] = 50
    assert codes(calculate(base_request)) == ["INVALID_NUMBER"]


def test_gwp_value_number_rejected():
    method = copy.deepcopy(METHOD)
    method["gwp_set"]["CH4"] = 28
    r = calculate(make_request(factors=[make_factor(), make_factor("TEST-NG-CH4", "CH4", "0.001")], method=method))
    assert codes(r) == ["INVALID_NUMBER"]
    assert r["blocks"][0]["field"] == "method.gwp_set.CH4"


def test_multiple_validation_blocks_collected():
    r = calculate(make_request(make_activity(quantity="-1", unit="bilmiyorum"), [make_factor(source_ref="")]))
    assert sorted(codes(r)) == ["FACTOR_MISSING_SOURCE", "NEGATIVE_QUANTITY", "UNIT_UNKNOWN"]


def test_co2_gwp_never_applied_even_if_set_contains_co2():
    method = copy.deepcopy(METHOD)
    method["gwp_set"]["CO2"] = "1"
    r = calculate(make_request(method=method))
    assert r["components"][0]["gwp_applied"] is False and r["components"][0]["gwp"] is None
    assert r["total_co2e_kg"] == "5000"


def test_co2e_factor_no_double_gwp():
    r = calculate(make_request(factors=[make_factor("F-CO2E", "CO2e", "52.5", gwp_set_id="TEST-GWP")]))
    assert r["coverage"] == "co2e_factor"
    assert r["components"][0]["gwp_applied"] is False
    assert r["total_co2e_kg"] == "5250"
    gwp_steps = [t for t in r["trace"] if t["step"] == "gwp"]
    assert gwp_steps == [{"step": "gwp", "gas": "CO2e", "applied": False, "reason": "faktör zaten CO2e; GWP ikinci kez uygulanmaz"}]


def test_full_ghg_exact():
    r = calculate(make_request(factors=[make_factor(), make_factor("F-CH4", "CH4", "0.001"), make_factor("F-N2O", "N2O", "0.0001")]))
    assert r["status"] == "computed" and r["coverage"] == "full_ghg"
    assert [c["co2e_kg"] for c in r["components"]] == ["5000", "2.8", "2.65"]
    assert [c["gwp_applied"] for c in r["components"]] == [False, True, True]
    assert [c["gwp"] for c in r["components"]] == [None, "28", "265"]
    assert r["total_co2e_kg"] == "5005.45"
    ch4_gwp = [t for t in r["trace"] if t["step"] == "gwp" and t["gas"] == "CH4"][0]
    assert ch4_gwp["applied"] is True and ch4_gwp["gwp"] == "28" and ch4_gwp["gwp_set_id"] == "TEST-GWP"
    # unit_conversion aynı hedef birim için bir kez yazılır
    assert sum(1 for t in r["trace"] if t["step"] == "unit_conversion") == 1
    assert sum(1 for t in r["trace"] if t["step"] == "factor_match") == 3


def test_partial_ghg_claim_lists_missing_gas():
    r = calculate(make_request(factors=[make_factor(), make_factor("F-N2O", "N2O", "0.0001")]))
    assert r["coverage"] == "partial_ghg"
    assert "CH₄" in r["claim_tr"] and "Tam CO₂e sonucu değildir" in r["claim_tr"]


def test_gwp_missing_blocks():
    method = {"id": "m", "version": "1", "gwp_set": {"id": "X", "N2O": "265"}}
    r = calculate(make_request(factors=[make_factor(), make_factor("F-CH4", "CH4", "0.001")], method=method))
    assert codes(r) == ["GWP_MISSING"]
    assert r["blocks"][0]["field"] == "method.gwp_set.CH4"


def test_gwp_set_absent_blocks_gas_factor_but_not_co2():
    method = {"id": "m", "version": "1"}
    assert calculate(make_request(method=method))["status"] == "computed"
    r = calculate(make_request(factors=[make_factor("F-CH4", "CH4", "0.001")], method=method))
    assert codes(r) == ["GWP_MISSING"]


def test_boundary_mix_blocks_and_boundary_null():
    r = calculate(make_request(factors=[make_factor(), make_factor("F-UP", "CH4", "0.01", boundary="upstream")]))
    assert codes(r) == ["BOUNDARY_MIX"]
    assert r["boundary"] is None


def test_upstream_only_is_allowed():
    r = calculate(make_request(factors=[make_factor("F-UP", "CO2", "5", boundary="upstream")]))
    assert r["status"] == "computed" and r["boundary"] == "upstream" and r["total_co2e_kg"] == "500"


def test_basis_unknown_t20():
    r = calculate(make_request(make_activity(heating_value_basis=None)))
    assert codes(r) == ["BASIS_UNKNOWN"]
    assert r["blocks"][0]["field"] == "activity.heating_value_basis"


def test_basis_mismatch_t04():
    r = calculate(make_request(make_activity(heating_value_basis="HHV")))
    assert codes(r) == ["BASIS_MISMATCH"]


def test_basis_conversion_review_required_t04():
    bc = {"ratio": "0.9", "from": "HHV", "to": "LHV", "source_ref": "tests — kurgusal oran"}
    r = calculate(make_request(make_activity(heating_value_basis="HHV", basis_conversion=bc)))
    assert r["status"] == "review_required"
    assert r["total_co2e_kg"] == "4500"
    assert r["normalized_activity"] == {"quantity": "90", "unit": "GJ", "basis": "LHV"}
    assert [w["code"] for w in r["warnings"]] == ["BASIS_CONVERSION_APPLIED"]
    bc_step = [t for t in r["trace"] if t["step"] == "basis_conversion"][0]
    assert bc_step["ratio"] == "0.9" and bc_step["source"] == "tests — kurgusal oran"
    assert bc_step["from"] == "100 GJ (HHV)" and bc_step["to"] == "90 GJ (LHV)"
    match = [t for t in r["trace"] if t["step"] == "factor_match"][0]
    assert match["basis_check"] == "HHV→LHV (oran 0.9)"


def test_basis_conversion_without_source_still_blocks():
    bc = {"ratio": "0.9", "from": "HHV", "to": "LHV", "source_ref": ""}
    r = calculate(make_request(make_activity(heating_value_basis="HHV", basis_conversion=bc)))
    assert codes(r) == ["BASIS_MISMATCH"]
    assert r["blocks"][0]["field"] == "activity.basis_conversion.source_ref"


def test_basis_conversion_wrong_direction_blocks():
    bc = {"ratio": "1.11", "from": "LHV", "to": "HHV", "source_ref": "x"}
    r = calculate(make_request(make_activity(heating_value_basis="HHV", basis_conversion=bc)))
    assert codes(r) == ["BASIS_MISMATCH"]


def test_basis_conversion_not_applied_when_bases_match():
    bc = {"ratio": "0.9", "from": "HHV", "to": "LHV", "source_ref": "x"}
    r = calculate(make_request(make_activity(heating_value_basis="LHV", basis_conversion=bc)))
    assert r["status"] == "computed" and r["total_co2e_kg"] == "5000"


def test_estimated_data_quality_review_required():
    r = calculate(make_request(make_activity(data_quality="estimated")))
    assert r["status"] == "review_required" and r["total_co2e_kg"] == "5000"
    assert [w["code"] for w in r["warnings"]] == ["DATA_QUALITY_ESTIMATED"]


def test_mwh_to_gj():
    r = calculate(make_request(make_activity(quantity="10", unit="MWh")))
    assert r["normalized_activity"]["quantity"] == "36" and r["total_co2e_kg"] == "1800"
    assert r["trace"][1] == {"step": "unit_conversion", "from": "10 MWh", "to": "36 GJ", "ratio": "3.6", "source": "sabit tablo"}


def test_tonne_numerator_scales_mass():
    r = calculate(make_request(factors=[make_factor("F-T", "CO2", "0.05", num="t")]))
    assert r["components"][0]["mass_kg"] == "5000" and r["total_co2e_kg"] == "5000"
    calc = [t for t in r["trace"] if t["step"] == "gas_calculation"][0]
    assert calc["formula"] == "100 × 0.05 × 1000 = 5000 kg"


def test_m3_without_conditions_blocked_t03():
    r = calculate(make_request(make_activity(quantity="1000", unit="m3", heating_value_basis=None), [make_factor(den="Nm3", basis=None)]))
    assert codes(r) == ["UNIT_CONDITIONS_UNKNOWN"]
    assert r["blocks"][0]["field"] == "activity.reference_conditions"


def test_m3_with_conditions_to_nm3_ideal_gas_in_trace():
    act = make_activity(quantity="28815", unit="m3", heating_value_basis=None, reference_conditions={"temperature_c": "15", "pressure_kpa": "101.325"})
    r = calculate(make_request(act, [make_factor(den="Nm3", basis=None, value="2")]))
    assert r["status"] == "computed" and r["total_co2e_kg"] == "54630"
    conv = r["trace"][1]
    assert conv["step"] == "unit_conversion"
    assert conv["from"] == "28815 m3 (15 °C, 101.325 kPa)"
    assert conv["to"] == "27315 Nm3 (0 °C, 101.325 kPa)"
    assert conv["source"].startswith("ideal gaz")
    from decimal import Decimal, localcontext
    from koza_calc.numbers import CONTEXT, format_decimal

    with localcontext(CONTEXT):
        assert conv["ratio"] == format_decimal(Decimal("273.15") / Decimal("288.15"))


def test_factor_m3_without_conditions_blocked():
    act = make_activity(quantity="1000", unit="Nm3", heating_value_basis=None)
    r = calculate(make_request(act, [make_factor(den="m3", basis=None)]))
    assert codes(r) == ["UNIT_CONDITIONS_UNKNOWN"]
    assert r["blocks"][0]["field"] == "factors[0].reference_conditions"


def test_factor_m3_with_conditions_ok():
    act = make_activity(quantity="1000", unit="Nm3", heating_value_basis=None)
    f = make_factor(den="m3", basis=None, value="2", reference_conditions={"temperature_c": "0", "pressure_kpa": "101.325"})
    r = calculate(make_request(act, [f]))
    assert r["status"] == "computed" and r["total_co2e_kg"] == "2000"


def test_volume_to_energy_with_calorific_value():
    cv = {"value": "38.5", "unit": "MJ/Sm3", "basis": "LHV", "source_ref": "tests — kurgusal"}
    r = calculate(make_request(make_activity(quantity="1000", unit="Sm3", heating_value_basis=None, calorific_value=cv)))
    assert r["status"] == "computed" and r["total_co2e_kg"] == "1925"
    assert r["normalized_activity"] == {"quantity": "38.5", "unit": "GJ", "basis": "LHV"}
    sources = [t["source"] for t in r["trace"] if t["step"] == "unit_conversion"]
    assert any("calorific_value 38.5 MJ/Sm3 (LHV); kaynak: tests — kurgusal" == s for s in sources)


def test_volume_to_energy_requires_calorific_value():
    r = calculate(make_request(make_activity(quantity="1000", unit="Sm3", heating_value_basis=None)))
    assert codes(r) == ["CALORIFIC_VALUE_REQUIRED"]


def test_calorific_value_without_source_blocks():
    cv = {"value": "38.5", "unit": "MJ/Sm3", "basis": "LHV", "source_ref": None}
    r = calculate(make_request(make_activity(quantity="1000", unit="Sm3", heating_value_basis=None, calorific_value=cv)))
    assert codes(r) == ["CALORIFIC_VALUE_REQUIRED"]
    assert r["blocks"][0]["field"] == "activity.calorific_value.source_ref"


def test_calorific_basis_mismatch_blocks():
    cv = {"value": "42.7", "unit": "MJ/Sm3", "basis": "HHV", "source_ref": "x"}
    r = calculate(make_request(make_activity(quantity="1000", unit="Sm3", heating_value_basis=None, calorific_value=cv)))
    assert codes(r) == ["BASIS_MISMATCH"]


def test_calorific_m3_volume_with_conditions_converted():
    # 28815 m3 @15 °C → 27315 Nm3 × 40 MJ/Nm3 = 1092600 MJ = 1092.6 GJ × 50 = 54630 kg
    cv = {"value": "40", "unit": "MJ/Nm3", "basis": "LHV", "source_ref": "x"}
    act = make_activity(quantity="28815", unit="m3", heating_value_basis=None, calorific_value=cv, reference_conditions={"temperature_c": "15", "pressure_kpa": "101.325"})
    r = calculate(make_request(act))
    assert r["status"] == "computed" and r["total_co2e_kg"] == "54630"


def test_unit_incompatible():
    assert codes(calculate(make_request(make_activity(unit="kg", heating_value_basis=None)))) == ["UNIT_INCOMPATIBLE"]
    assert codes(calculate(make_request(make_activity(unit="GJ"), [make_factor(den="Nm3", basis=None)]))) == ["UNIT_INCOMPATIBLE"]
    assert codes(calculate(make_request(make_activity(unit="Nm3", heating_value_basis=None), [make_factor(den="kg", basis=None)]))) == ["UNIT_INCOMPATIBLE"]


def test_factor_numerator_must_be_mass():
    assert codes(calculate(make_request(factors=[make_factor(num="GJ")]))) == ["UNIT_INCOMPATIBLE"]
    assert codes(calculate(make_request(factors=[make_factor(num="")]))) == ["FACTOR_UNIT_MISSING"]
    assert codes(calculate(make_request(factors=[make_factor(num="lb")]))) == ["UNIT_UNKNOWN"]


def test_unsupported_source_type():
    assert codes(calculate(make_request(make_activity(source_type="mobile_combustion")))) == ["UNSUPPORTED_SOURCE_TYPE"]


def test_duplicate_gas_blocks():
    assert codes(calculate(make_request(factors=[make_factor(), make_factor("F2", "CO2", "51")]))) == ["FACTOR_DUPLICATE_GAS"]


def test_mix_co2e_and_gas_blocks():
    assert codes(calculate(make_request(factors=[make_factor("F-E", "CO2e", "52"), make_factor("F-CH4", "CH4", "0.001")]))) == ["FACTOR_MIX_CO2E_AND_GAS"]


def test_structural_errors_do_not_raise():
    assert calculate(None)["status"] == "blocked"
    assert calculate([])["status"] == "blocked"
    assert calculate({})["status"] == "blocked"
    r = calculate({"activity": make_activity(), "factors": [], "method": METHOD})
    assert codes(r) == ["INVALID_REQUEST"] and r["blocks"][0]["field"] == "factors"
    r = calculate(make_request(factors=[make_factor(gas="HFC")]))
    assert codes(r) == ["INVALID_REQUEST"] and r["blocks"][0]["field"] == "factors[0].gas"
    r = calculate(make_request(factors=[make_factor(boundary=None)]))
    assert codes(r) == ["INVALID_REQUEST"]


def test_zero_quantity_is_measured_zero():
    r = calculate(make_request(make_activity(quantity="0")))
    assert r["status"] == "computed" and r["total_co2e_kg"] == "0"


def test_no_rounding_long_decimal_preserved():
    r = calculate(make_request(make_activity(quantity="1", unit="GJ"), [make_factor(value="1", den="kWh")]))
    # 1 GJ = 277.77… kWh, 34 basamak korunur; üstel gösterim yok
    assert r["total_co2e_kg"] == "277.7777777777777777777777777777778"


def test_determinism_same_request_twice_and_key_orders(base_request):
    first = calculate(base_request)
    second = calculate(copy.deepcopy(base_request))
    assert first == second

    def shuffle(obj):
        if isinstance(obj, dict):
            return {k: shuffle(obj[k]) for k in reversed(list(obj))}
        if isinstance(obj, list):
            return [shuffle(x) for x in obj]
        return obj

    shuffled = shuffle(base_request)
    assert list(shuffled) != list(base_request)
    third = calculate(shuffled)
    assert third == first
    assert third["inputs_hash"] == first["inputs_hash"]


def test_inputs_hash_matches_canonical_json(base_request):
    import hashlib

    canonical = json.dumps(base_request, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    expected = "sha256:" + hashlib.sha256(canonical.encode("ascii")).hexdigest()
    assert calculate(base_request)["inputs_hash"] == expected
    changed = copy.deepcopy(base_request)
    changed["activity"]["quantity"] = "100.0"
    assert calculate(changed)["inputs_hash"] != expected


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


@pytest.mark.parametrize(
    "req",
    [
        make_request(),
        make_request(make_activity(quantity="-1")),
        make_request(make_activity(heating_value_basis="HHV", basis_conversion={"ratio": "0.9", "from": "HHV", "to": "LHV", "source_ref": "x"})),
        make_request(factors=[make_factor(), make_factor("F-CH4", "CH4", "0.001"), make_factor("F-N2O", "N2O", "0.0001")]),
    ],
)
def test_output_is_json_serializable_with_plain_types(req):
    r = calculate(req)
    _check_json_types(r)
    text = json.dumps(r, ensure_ascii=False)
    assert json.loads(text) == r


def test_calculate_does_not_mutate_request(base_request):
    snapshot = copy.deepcopy(base_request)
    calculate(base_request)
    assert base_request == snapshot


def test_no_float_in_package_source():
    pkg = Path(__file__).resolve().parents[1] / "koza_calc"
    offenders = []
    for py in sorted(pkg.glob("*.py")):
        text = py.read_text(encoding="utf-8")
        if re.search(r"\bfloat\s*\(", text):
            offenders.append(py.name)
    assert offenders == []


def test_package_uses_only_stdlib_imports():
    pkg = Path(__file__).resolve().parents[1] / "koza_calc"
    allowed = {"decimal", "hashlib", "json", "re", "os", "__future__"}
    for py in sorted(pkg.glob("*.py")):
        for line in py.read_text(encoding="utf-8").splitlines():
            m = re.match(r"^\s*(?:from\s+(\S+)\s+import|import\s+(\S+))", line)
            if not m:
                continue
            mod = (m.group(1) or m.group(2)).split(".")[0]
            if mod == "" or mod.startswith("."):
                continue
            assert mod in allowed, f"{py.name}: {line.strip()}"
