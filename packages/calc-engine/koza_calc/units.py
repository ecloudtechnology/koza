"""Birim aileleri ve dönüşümler.

* Enerji: MJ, GJ, kWh, MWh — sabit tablo (MJ cinsinden).
* Kütle: kg, t.
* Hacim: m3, Nm3, Sm3 — Nm3 (0 °C, 101.325 kPa) ve Sm3 (15 °C, 101.325 kPa)
  tanımlıdır; düz m3 yalnız referans koşuluyla dönüşür. Dönüşüm ideal gaz
  oranıyla yapılır: V2 = V1 · T2/T1 · P1/P2 (sıcaklık kelvin).
"""

from __future__ import annotations

from decimal import Decimal

from .errors import CalcBlock

ENERGY = "energy"
MASS = "mass"
VOLUME = "volume"

ENERGY_IN_MJ: dict[str, Decimal] = {
    "MJ": Decimal("1"),
    "GJ": Decimal("1000"),
    "kWh": Decimal("3.6"),
    "MWh": Decimal("3600"),
}

MASS_IN_KG: dict[str, Decimal] = {
    "kg": Decimal("1"),
    "t": Decimal("1000"),
}

#: Tanımlı standart hacimler: (sıcaklık °C, basınç kPa)
STANDARD_CONDITIONS: dict[str, tuple[Decimal, Decimal]] = {
    "Nm3": (Decimal("0"), Decimal("101.325")),
    "Sm3": (Decimal("15"), Decimal("101.325")),
}

VOLUME_UNITS = ("m3", "Nm3", "Sm3")

KELVIN_OFFSET = Decimal("273.15")

IDEAL_GAS_SOURCE = "ideal gaz: V2 = V1 · T2/T1 · P1/P2 (kelvin)"
FIXED_TABLE_SOURCE = "sabit tablo"


def unit_family(unit: object) -> str | None:
    if not isinstance(unit, str):
        return None
    if unit in ENERGY_IN_MJ:
        return ENERGY
    if unit in MASS_IN_KG:
        return MASS
    if unit in VOLUME_UNITS:
        return VOLUME
    return None


def is_known_unit(unit: object) -> bool:
    return unit_family(unit) is not None


def parse_rate_unit(unit: object) -> tuple[str, str]:
    """"MJ/m3" -> ("MJ", "m3"). Tanınmayan biçimde ValueError."""
    if not isinstance(unit, str) or unit.count("/") != 1:
        raise ValueError("oran birimi 'pay/payda' biçiminde olmalı")
    numerator, denominator = unit.split("/")
    if not numerator or not denominator:
        raise ValueError("oran biriminde pay veya payda boş")
    return numerator, denominator


def convert_energy(quantity: Decimal, from_unit: str, to_unit: str) -> tuple[Decimal, Decimal]:
    """Enerji birim dönüşümü; (sonuç, oran) döner."""
    ratio = ENERGY_IN_MJ[from_unit] / ENERGY_IN_MJ[to_unit]
    # Önce çarp, bir kez böl: temsil edilebilir sonuçlar tam kalır.
    return (quantity * ENERGY_IN_MJ[from_unit]) / ENERGY_IN_MJ[to_unit], ratio


def convert_mass(quantity: Decimal, from_unit: str, to_unit: str) -> tuple[Decimal, Decimal]:
    ratio = MASS_IN_KG[from_unit] / MASS_IN_KG[to_unit]
    return (quantity * MASS_IN_KG[from_unit]) / MASS_IN_KG[to_unit], ratio


def kelvin(temperature_c: Decimal, field: str) -> Decimal:
    t_k = temperature_c + KELVIN_OFFSET
    if t_k == 0:
        raise CalcBlock("DIVISION_BY_ZERO", field, "sıcaklık 0 K")
    if t_k < 0:
        raise CalcBlock("INVALID_NUMBER", field, "mutlak sıfırın altında sıcaklık")
    return t_k


def _gas_terms(
    from_conditions: tuple[Decimal, Decimal],
    to_conditions: tuple[Decimal, Decimal],
    from_field: str,
    to_field: str,
) -> tuple[Decimal, Decimal, Decimal, Decimal]:
    """(T1, P1, T2, P2) kelvin/kPa; sıfır veya negatif değerde blok."""
    t1 = kelvin(from_conditions[0], from_field + ".temperature_c")
    t2 = kelvin(to_conditions[0], to_field + ".temperature_c")
    p1, p2 = from_conditions[1], to_conditions[1]
    for p, field in ((p1, from_field + ".pressure_kpa"), (p2, to_field + ".pressure_kpa")):
        if p == 0:
            raise CalcBlock("DIVISION_BY_ZERO", field, "basınç 0 kPa")
        if p < 0:
            raise CalcBlock("INVALID_NUMBER", field, "negatif basınç")
    return t1, p1, t2, p2


def volume_ratio(
    from_conditions: tuple[Decimal, Decimal],
    to_conditions: tuple[Decimal, Decimal],
    from_field: str = "activity.reference_conditions",
    to_field: str = "factor.reference_conditions",
) -> Decimal:
    """İdeal gaz oranı: V2/V1 = T2/T1 · P1/P2."""
    t1, p1, t2, p2 = _gas_terms(from_conditions, to_conditions, from_field, to_field)
    return (t2 * p1) / (t1 * p2)


def convert_volume(
    quantity: Decimal,
    from_conditions: tuple[Decimal, Decimal],
    to_conditions: tuple[Decimal, Decimal],
    from_field: str = "activity.reference_conditions",
    to_field: str = "factor.reference_conditions",
) -> tuple[Decimal, Decimal]:
    if from_conditions == to_conditions:
        return quantity, Decimal("1")
    t1, p1, t2, p2 = _gas_terms(from_conditions, to_conditions, from_field, to_field)
    ratio = (t2 * p1) / (t1 * p2)
    # Önce çarp, bir kez böl: 28815 m3 (15 °C) → tam 27315 Nm3.
    return (quantity * t2 * p1) / (t1 * p2), ratio


def resolve_conditions(
    unit: str, reference_conditions: tuple[Decimal, Decimal] | None
) -> tuple[Decimal, Decimal] | None:
    """Hacim biriminin koşullarını döner; düz m3 koşulsuz ise None."""
    if unit in STANDARD_CONDITIONS:
        return STANDARD_CONDITIONS[unit]
    return reference_conditions


def describe_conditions(conditions: tuple[Decimal, Decimal]) -> str:
    from .numbers import format_decimal

    return f"{format_decimal(conditions[0])} °C, {format_decimal(conditions[1])} kPa"
