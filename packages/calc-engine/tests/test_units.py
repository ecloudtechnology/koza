from decimal import Decimal

import pytest

from koza_calc import units as U
from koza_calc.errors import CalcBlock


def test_families():
    assert U.unit_family("GJ") == U.ENERGY
    assert U.unit_family("MWh") == U.ENERGY
    assert U.unit_family("t") == U.MASS
    assert U.unit_family("Nm3") == U.VOLUME
    assert U.unit_family("m3") == U.VOLUME
    assert U.unit_family("bilmiyorum") is None
    assert U.unit_family("gj") is None  # büyük/küçük harf duyarlı
    assert U.unit_family(None) is None


@pytest.mark.parametrize(
    "q, src, dst, expected, ratio",
    [
        ("1", "MWh", "GJ", "3.6", "3.6"),
        ("10", "MWh", "GJ", "36", "3.6"),
        ("1000", "kWh", "GJ", "3.6", "0.0036"),
        ("1000", "kWh", "MJ", "3600", "3.6"),
        ("1", "GJ", "kWh", "277.7777777777777777777777777777778", "277.7777777777777777777777777777778"),
        ("100", "GJ", "GJ", "100", "1"),
        ("3.6", "MJ", "kWh", "1", "0.2777777777777777777777777777777778"),
    ],
)
def test_energy_conversion(q, src, dst, expected, ratio):
    from koza_calc.numbers import CONTEXT, format_decimal
    from decimal import localcontext

    with localcontext(CONTEXT):
        out, r = U.convert_energy(Decimal(q), src, dst)
        assert format_decimal(out) == expected
        assert format_decimal(r) == ratio


def test_mass_conversion():
    out, r = U.convert_mass(Decimal("0.05"), "t", "kg")
    assert out == Decimal("50") and r == Decimal("1000")
    out, _ = U.convert_mass(Decimal("2500"), "kg", "t")
    assert out == Decimal("2.5")


def test_standard_conditions_defined():
    assert U.resolve_conditions("Nm3", None) == (Decimal("0"), Decimal("101.325"))
    assert U.resolve_conditions("Sm3", None) == (Decimal("15"), Decimal("101.325"))
    assert U.resolve_conditions("m3", None) is None
    assert U.resolve_conditions("m3", (Decimal("20"), Decimal("100"))) == (Decimal("20"), Decimal("100"))


def test_ideal_gas_ratio_sm3_to_nm3():
    from decimal import localcontext
    from koza_calc.numbers import CONTEXT

    with localcontext(CONTEXT):
        sm3 = U.STANDARD_CONDITIONS["Sm3"]
        nm3 = U.STANDARD_CONDITIONS["Nm3"]
        ratio = U.volume_ratio(sm3, nm3)
        assert ratio == Decimal("273.15") / Decimal("288.15")
        out, r = U.convert_volume(Decimal("28815"), sm3, nm3)
        assert out == Decimal("27315")
        assert r == ratio
        # Ters yön
        back, _ = U.convert_volume(Decimal("27315"), nm3, sm3)
        assert back == Decimal("28815")


def test_ideal_gas_pressure_term():
    from decimal import localcontext
    from koza_calc.numbers import CONTEXT

    with localcontext(CONTEXT):
        # Aynı sıcaklık, basınç iki kat: hacim yarıya iner.
        out, r = U.convert_volume(Decimal("10"), (Decimal("0"), Decimal("200")), (Decimal("0"), Decimal("100")))
        assert out == Decimal("20") and r == Decimal("2")


def test_same_conditions_ratio_one():
    out, r = U.convert_volume(Decimal("5"), (Decimal("15"), Decimal("101.325")), (Decimal("15"), Decimal("101.325")))
    assert out == Decimal("5") and r == Decimal("1")


def test_zero_pressure_blocks_division_by_zero():
    with pytest.raises(CalcBlock) as exc:
        U.volume_ratio((Decimal("15"), Decimal("0")), U.STANDARD_CONDITIONS["Nm3"])
    assert exc.value.code == "DIVISION_BY_ZERO"


def test_zero_kelvin_blocks():
    with pytest.raises(CalcBlock) as exc:
        U.volume_ratio((Decimal("-273.15"), Decimal("101.325")), U.STANDARD_CONDITIONS["Nm3"])
    assert exc.value.code == "DIVISION_BY_ZERO"
    with pytest.raises(CalcBlock) as exc:
        U.volume_ratio((Decimal("-300"), Decimal("101.325")), U.STANDARD_CONDITIONS["Nm3"])
    assert exc.value.code == "INVALID_NUMBER"


def test_parse_rate_unit():
    assert U.parse_rate_unit("MJ/m3") == ("MJ", "m3")
    with pytest.raises(ValueError):
        U.parse_rate_unit("MJ")
    with pytest.raises(ValueError):
        U.parse_rate_unit("MJ/m3/x")
