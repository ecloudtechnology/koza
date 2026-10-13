from decimal import Decimal

import pytest

from koza_calc.numbers import NumberError, format_decimal, parse_decimal


@pytest.mark.parametrize("value", ["100", "0.4", "-5", "38.5", "1e3", "+2", ".5"])
def test_parse_accepts_decimal_strings(value):
    assert isinstance(parse_decimal(value), Decimal)


@pytest.mark.parametrize("value", [100, 0.4, True, False, None, "", " 1", "1 ", "abc", "NaN", "Infinity", "-inf", "1,5", [], {}])
def test_parse_rejects_non_strings_and_garbage(value):
    with pytest.raises(NumberError):
        parse_decimal(value)


@pytest.mark.parametrize(
    "value, expected",
    [
        ("5E+3", "5000"),
        ("0.4000", "0.4"),
        ("1.23E-4", "0.000123"),
        ("0", "0"),
        ("0.000", "0"),
        ("-0", "0"),
        ("-2.50", "-2.5"),
        ("1000000000000000000000000", "1000000000000000000000000"),
        ("0.0000000001", "0.0000000001"),
        ("5005.45", "5005.45"),
    ],
)
def test_format_plain_without_exponent(value, expected):
    out = format_decimal(Decimal(value))
    assert out == expected
    assert "E" not in out and "e" not in out
