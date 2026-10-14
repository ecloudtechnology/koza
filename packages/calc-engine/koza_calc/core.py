"""Ortak çekirdek: doğrulama, birim dönüşümü, gaz bazlı hesap, yanıt biçimi.

İşlem sırası (§18): girdi doğrulama → birim/koşul dönüşümü → sınır ve faktör
uyumu → gaz bazlı hesap → gerekiyorsa GWP → sonuç ve iz kaydı → kalite durumu.

Kaynak türü modülleri (engine, scope2, scope3, refrigerant, product) bu
çekirdeği kullanır. Saf fonksiyonlar: I/O yok, saat yok, rastgelelik yok,
`float` yok.
"""

from __future__ import annotations

import hashlib
import json
from decimal import Decimal

from . import units as U
from .errors import CalcBlock, block, warning
from .numbers import NumberError, format_decimal, parse_decimal

ENGINE_VERSION = "0.2.0"

GASES = ("CO2", "CH4", "N2O", "CO2e")
GHG_GASES = ("CO2", "CH4", "N2O")
BASES = ("LHV", "HHV")
#: 0.1 sınırları + 0.2 ekleri. Kaynak türü modülleri daha dar liste verebilir.
BOUNDARIES = (
    "combustion",
    "upstream",
    "cradle_to_gate",
    "well_to_wheel",
    "fugitive",
    "process",
    "gate_to_gate",
    "cradle_to_grave",
    "well_to_tank",
    "tank_to_wheel",
    "end_of_life",
)
DATA_QUALITIES = ("measured", "estimated")
VALUE_STATES = ("known", "unknown", "not_applicable")

CLAIM_TR = {
    "co2_only": "Yalnız CO₂ bileşeni; tam CO₂e sonucu değildir.",
    "co2e_factor": "CO₂e bazlı faktörle hesaplandı; GWP ikinci kez uygulanmadı.",
    "full_ghg": "CO₂, CH₄ ve N₂O bileşenleriyle tam CO₂e sonucu.",
    "partial_ghg": "Kısmi sera gazı sonucu ({present}); eksik gaz: {missing}. Tam CO₂e sonucu değildir.",
    "blocked": "Hesap yapılmadı; engeller giderilmeden sonuç üretilmez.",
}

GAS_LABEL_TR = {"CO2": "CO₂", "CH4": "CH₄", "N2O": "N₂O", "CO2e": "CO₂e"}


# --------------------------------------------------------------------------- #
# Yardımcılar
# --------------------------------------------------------------------------- #


def inputs_hash(request: object) -> str | None:
    """Kanonik JSON (sıralı anahtar, ascii, boşluksuz) üzerinden sha256."""
    try:
        canonical = json.dumps(
            request, sort_keys=True, separators=(",", ":"), ensure_ascii=True
        )
    except (TypeError, ValueError):
        return None
    return "sha256:" + hashlib.sha256(canonical.encode("ascii")).hexdigest()


def is_nonempty_str(value: object) -> bool:
    return isinstance(value, str) and value.strip() != ""


def is_bool(value: object) -> bool:
    return isinstance(value, bool)


class Validator:
    """Blokları toplar; alan okuma yardımcıları sağlar."""

    def __init__(self) -> None:
        self.blocks: list[dict] = []

    def add(self, code: str, field: str | None = None, detail: str | None = None) -> None:
        self.blocks.append(block(code, field, detail))

    def has(self, code: str) -> bool:
        return any(b["code"] == code for b in self.blocks)

    def number(self, value: object, field: str) -> Decimal | None:
        try:
            return parse_decimal(value)
        except NumberError as exc:
            self.add("INVALID_NUMBER", field, str(exc))
            return None

    def optional_number(self, value: object, field: str) -> Decimal | None:
        if value is None:
            return None
        return self.number(value, field)

    def conditions(self, value: object, field: str) -> tuple[Decimal, Decimal] | None:
        """{"temperature_c": "15", "pressure_kpa": "101.325"} -> (t, p)."""
        if value is None:
            return None
        if not isinstance(value, dict):
            self.add("INVALID_REQUEST", field, "koşul nesnesi bekleniyor")
            return None
        t = self.number(value.get("temperature_c"), field + ".temperature_c")
        p = self.number(value.get("pressure_kpa"), field + ".pressure_kpa")
        if t is None or p is None:
            return None
        return (t, p)


# --------------------------------------------------------------------------- #
# Doğrulama
# --------------------------------------------------------------------------- #


def validate_activity(raw: object, v: Validator, *, allow_null_quantity: bool = False) -> dict | None:
    """Ortak faaliyet alanları. Kaynak türü denetimi çağıran modüldedir."""
    if not isinstance(raw, dict):
        v.add("INVALID_REQUEST", "activity", "faaliyet kaydı nesnesi eksik")
        return None

    act: dict = {"id": raw.get("id"), "version": raw.get("version"), "source_type": raw.get("source_type")}
    act["fuel"] = raw.get("fuel")

    quantity_raw = raw.get("quantity")
    if quantity_raw is None and allow_null_quantity:
        quantity = None
    else:
        quantity = v.number(quantity_raw, "activity.quantity")
        if quantity is not None and quantity < 0:
            v.add("NEGATIVE_QUANTITY", "activity.quantity")
    act["quantity"] = quantity

    unit = raw.get("unit")
    if unit is None and allow_null_quantity and quantity is None:
        pass
    elif not U.is_known_unit(unit):
        v.add("UNIT_UNKNOWN", "activity.unit", str(unit))
    act["unit"] = unit

    basis = raw.get("heating_value_basis")
    if basis is not None and basis not in BASES:
        v.add("INVALID_REQUEST", "activity.heating_value_basis", "LHV, HHV veya null olmalı")
        basis = None
    act["basis"] = basis

    act["reference_conditions"] = v.conditions(
        raw.get("reference_conditions"), "activity.reference_conditions"
    )

    cv_raw = raw.get("calorific_value")
    act["calorific_value"] = None
    if cv_raw is not None:
        if not isinstance(cv_raw, dict):
            v.add("INVALID_REQUEST", "activity.calorific_value", "nesne bekleniyor")
        else:
            cv: dict = {}
            cv["value"] = v.number(cv_raw.get("value"), "activity.calorific_value.value")
            try:
                cv["energy_unit"], cv["volume_unit"] = U.parse_rate_unit(cv_raw.get("unit"))
            except ValueError as exc:
                v.add("UNIT_UNKNOWN", "activity.calorific_value.unit", str(exc))
                cv["energy_unit"] = cv["volume_unit"] = None
            else:
                if U.unit_family(cv["energy_unit"]) != U.ENERGY:
                    v.add("UNIT_UNKNOWN", "activity.calorific_value.unit", "pay enerji birimi değil")
                if U.unit_family(cv["volume_unit"]) != U.VOLUME:
                    v.add("UNIT_UNKNOWN", "activity.calorific_value.unit", "payda hacim birimi değil")
            cv_basis = cv_raw.get("basis")
            if cv_basis is not None and cv_basis not in BASES:
                v.add("INVALID_REQUEST", "activity.calorific_value.basis", "LHV, HHV veya null olmalı")
                cv_basis = None
            cv["basis"] = cv_basis
            cv["source_ref"] = cv_raw.get("source_ref")
            if not is_nonempty_str(cv["source_ref"]):
                v.add("CALORIFIC_VALUE_REQUIRED", "activity.calorific_value.source_ref", "ısıl değerin kaynağı yok")
            cv["reference_conditions"] = v.conditions(
                cv_raw.get("reference_conditions"), "activity.calorific_value.reference_conditions"
            )
            act["calorific_value"] = cv

    bc_raw = raw.get("basis_conversion")
    act["basis_conversion"] = None
    if bc_raw is not None:
        if not isinstance(bc_raw, dict):
            v.add("INVALID_REQUEST", "activity.basis_conversion", "nesne bekleniyor")
        else:
            bc: dict = {}
            ratio = v.number(bc_raw.get("ratio"), "activity.basis_conversion.ratio")
            if ratio is not None and ratio <= 0:
                v.add("INVALID_NUMBER", "activity.basis_conversion.ratio", "oran pozitif olmalı")
                ratio = None
            bc["ratio"] = ratio
            bc["from"] = bc_raw.get("from")
            bc["to"] = bc_raw.get("to")
            for key in ("from", "to"):
                if bc[key] not in BASES:
                    v.add("INVALID_REQUEST", f"activity.basis_conversion.{key}", "LHV veya HHV olmalı")
            bc["source_ref"] = bc_raw.get("source_ref")
            act["basis_conversion"] = bc

    # 0.2: yakıt yoğunluğu (kütle ↔ sıvı hacim), yalnız açık ve kaynaklı verilirse
    d_raw = raw.get("density")
    act["density"] = None
    if d_raw is not None:
        if not isinstance(d_raw, dict):
            v.add("DENSITY_REQUIRED", "activity.density", "nesne bekleniyor")
        else:
            d: dict = {"value": v.number(d_raw.get("value"), "activity.density.value")}
            if d["value"] is not None and d["value"] <= 0:
                v.add("INVALID_NUMBER", "activity.density.value", "yoğunluk pozitif olmalı")
                d["value"] = None
            if d_raw.get("unit") != "kg/L":
                v.add("DENSITY_REQUIRED", "activity.density.unit", "yoğunluk birimi kg/L olmalı")
            d["unit"] = d_raw.get("unit")
            d["source_ref"] = d_raw.get("source_ref")
            if not is_nonempty_str(d["source_ref"]):
                v.add("DENSITY_REQUIRED", "activity.density.source_ref", "yoğunluğun kaynağı yok")
            act["density"] = d

    data_quality = raw.get("data_quality")
    if data_quality not in DATA_QUALITIES:
        v.add("INVALID_REQUEST", "activity.data_quality", "measured veya estimated olmalı")
    act["data_quality"] = data_quality

    return act


def validate_factor(
    raw: object,
    index: int,
    v: Validator,
    *,
    gases: tuple[str, ...] = GASES,
    boundaries: tuple[str, ...] = BOUNDARIES,
    field: str | None = None,
) -> dict | None:
    field = field if field is not None else f"factors[{index}]"
    if not isinstance(raw, dict):
        v.add("INVALID_REQUEST", field, "faktör nesnesi bekleniyor")
        return None

    f: dict = {"index": index, "field": field}
    f["id"] = raw.get("id")
    f["version"] = raw.get("version")
    if not is_nonempty_str(f["id"]):
        v.add("INVALID_REQUEST", field + ".id", "faktör kimliği eksik")
    if f["version"] is None or not isinstance(f["version"], str) or not f["version"].strip():
        v.add("INVALID_REQUEST", field + ".version", "faktör sürümü eksik")

    f["value"] = v.number(raw.get("value"), field + ".value")

    num = raw.get("numerator_unit")
    if not is_nonempty_str(num):
        v.add("FACTOR_UNIT_MISSING", field + ".numerator_unit")
    elif not U.is_known_unit(num):
        v.add("UNIT_UNKNOWN", field + ".numerator_unit", num)
    elif U.unit_family(num) != U.MASS:
        v.add("UNIT_INCOMPATIBLE", field + ".numerator_unit", "pay kütle birimi (kg | t) olmalı")
    f["numerator_unit"] = num

    den = raw.get("denominator_unit")
    if not is_nonempty_str(den):
        v.add("FACTOR_UNIT_MISSING", field + ".denominator_unit")
    elif not U.is_known_unit(den):
        v.add("UNIT_UNKNOWN", field + ".denominator_unit", den)
    f["denominator_unit"] = den

    gas = raw.get("gas")
    if gas not in gases:
        v.add("INVALID_REQUEST", field + ".gas", "gaz " + ", ".join(gases) + " olmalı")
    f["gas"] = gas

    basis = raw.get("basis")
    if basis is not None and basis not in BASES:
        v.add("INVALID_REQUEST", field + ".basis", "LHV, HHV veya null olmalı")
        basis = None
    f["basis"] = basis

    f["reference_conditions"] = v.conditions(
        raw.get("reference_conditions"), field + ".reference_conditions"
    )

    boundary = raw.get("boundary")
    if boundary not in boundaries:
        v.add("INVALID_REQUEST", field + ".boundary", "sınır eksik veya bu kaynak türü için tanınmıyor")
    f["boundary"] = boundary

    f["source_ref"] = raw.get("source_ref")
    if not is_nonempty_str(f["source_ref"]):
        v.add("FACTOR_MISSING_SOURCE", field + ".source_ref")

    f["gwp_set_id"] = raw.get("gwp_set_id")
    f["role"] = raw.get("role")
    return f


def validate_factors(
    raw: object,
    v: Validator,
    *,
    gases: tuple[str, ...] = GASES,
    boundaries: tuple[str, ...] = BOUNDARIES,
    required: bool = True,
) -> list[dict]:
    factors: list[dict] = []
    if raw is None and not required:
        return factors
    if not isinstance(raw, list) or (required and not raw):
        v.add("INVALID_REQUEST", "factors", "en az bir faktör gerekli" if required else "faktör listesi bekleniyor")
        return factors
    for i, item in enumerate(raw):
        f = validate_factor(item, i, v, gases=gases, boundaries=boundaries)
        if f is not None:
            factors.append(f)
    return factors


def validate_method(raw: object, v: Validator) -> tuple[dict, dict]:
    """(yanıt method nesnesi, {"id", "values": gaz -> Decimal GWP}) döner."""
    if not isinstance(raw, dict):
        v.add("INVALID_REQUEST", "method", "yöntem nesnesi eksik")
        return {"id": None, "version": None}, {"id": None, "values": {}}
    method_out = {"id": raw.get("id"), "version": raw.get("version")}
    if not is_nonempty_str(method_out["id"]) or not is_nonempty_str(method_out["version"]):
        v.add("INVALID_REQUEST", "method", "yöntem kimliği ve sürümü zorunlu")
    gwp_raw = raw.get("gwp_set")
    gwp: dict = {"id": None, "values": {}}
    if gwp_raw is not None:
        if not isinstance(gwp_raw, dict):
            v.add("INVALID_REQUEST", "method.gwp_set", "nesne bekleniyor")
        else:
            gwp["id"] = gwp_raw.get("id")
            for gas, value in gwp_raw.items():
                if gas == "id":
                    continue
                parsed = v.number(value, f"method.gwp_set.{gas}")
                if parsed is not None:
                    gwp["values"][gas] = parsed
    return method_out, gwp


def check_factor_set(
    factors: list[dict], gwp: dict, v: Validator, *, check_boundary_mix: bool = True, duplicate_by_boundary: bool = False
) -> None:
    """Faktör kümesi uyumu. `duplicate_by_boundary=True` (Kapsam 3 sınır çakışması):
    aynı gaz farklı sınırda çift faktör sayılmaz; sorun BOUNDARY_OVERLAP olarak raporlanır."""
    seen: set[tuple] = set()
    for f in factors:
        key = (f["gas"], f["boundary"]) if duplicate_by_boundary else (f["gas"],)
        if key in seen:
            v.add("FACTOR_DUPLICATE_GAS", f["field"] + ".gas", f["gas"])
        else:
            seen.add(key)

    gases = {f["gas"] for f in factors}
    if "CO2e" in gases and gases - {"CO2e"}:
        v.add("FACTOR_MIX_CO2E_AND_GAS", "factors")

    if check_boundary_mix:
        boundaries = {f["boundary"] for f in factors}
        if len(boundaries) > 1:
            v.add("BOUNDARY_MIX", "factors", ", ".join(sorted(str(b) for b in boundaries)))

    for f in factors:
        if f["gas"] in ("CH4", "N2O") and f["gas"] not in gwp["values"]:
            v.add("GWP_MISSING", f"method.gwp_set.{f['gas']}", f["gas"])


def single_boundary(factors: list[dict]) -> str | None:
    if factors and len({f["boundary"] for f in factors}) == 1:
        return factors[0]["boundary"]
    return None


def validate_step(v: Validator, act: dict | None, **extra) -> dict:
    step = {"step": "validate_input", "ok": not v.blocks}
    if act is not None:
        step["activity_id"] = act["id"]
        step["activity_version"] = act["version"]
    step.update(extra)
    return step


# --------------------------------------------------------------------------- #
# Birim / esas dönüşümü
# --------------------------------------------------------------------------- #


def _apply_basis(
    quantity: Decimal,
    unit: str,
    quantity_basis: str | None,
    quantity_basis_field: str,
    factor: dict,
    act: dict,
    trace: list,
    state: dict,
) -> Decimal:
    """Enerji miktarının esasını faktör esasına uydurur; gerekirse oran uygular."""
    f_basis = factor["basis"]
    if f_basis is None:
        # Faktör esasa bağlı değil (örn. kWh başına CO2e): esas denetimi yok.
        state["basis_check"] = "faktör esassız"
        state["effective_basis"] = quantity_basis
        return quantity
    state["effective_basis"] = f_basis
    if quantity_basis is None:
        raise CalcBlock("BASIS_UNKNOWN", quantity_basis_field)
    if quantity_basis == f_basis:
        state["basis_check"] = f"{quantity_basis}={f_basis}"
        return quantity

    bc = act["basis_conversion"]
    if bc is None or bc["ratio"] is None:
        raise CalcBlock("BASIS_MISMATCH", quantity_basis_field, f"{quantity_basis} ≠ {f_basis}")
    if not is_nonempty_str(bc["source_ref"]):
        raise CalcBlock(
            "BASIS_MISMATCH", "activity.basis_conversion.source_ref", "dönüşüm oranının kaynağı yok"
        )
    if bc["from"] != quantity_basis or bc["to"] != f_basis:
        raise CalcBlock(
            "BASIS_MISMATCH",
            "activity.basis_conversion",
            f"verilen oran {bc['from']}→{bc['to']}, gereken {quantity_basis}→{f_basis}",
        )
    converted = quantity * bc["ratio"]
    state["basis_check"] = f"{quantity_basis}→{f_basis} (oran {format_decimal(bc['ratio'])})"
    state["basis_conversion_used"] = True
    key = ("basis_conversion", unit)
    if key not in state["emitted"]:
        state["emitted"].add(key)
        trace.append(
            {
                "step": "basis_conversion",
                "from": f"{format_decimal(quantity)} {unit} ({quantity_basis})",
                "to": f"{format_decimal(converted)} {unit} ({f_basis})",
                "ratio": format_decimal(bc["ratio"]),
                "source": bc["source_ref"],
            }
        )
    return converted


def _emit_conversion(trace: list, state: dict, key: tuple, step: dict) -> None:
    if key in state["emitted"]:
        return
    state["emitted"].add(key)
    trace.append(step)


def _fixed_step(q: Decimal, q_unit: str, converted: Decimal, f_unit: str, ratio: Decimal, source: str = U.FIXED_TABLE_SOURCE) -> dict:
    return {
        "step": "unit_conversion",
        "from": f"{format_decimal(q)} {q_unit}",
        "to": f"{format_decimal(converted)} {f_unit}",
        "ratio": format_decimal(ratio),
        "source": source,
    }


def _density(act: dict) -> dict:
    d = act.get("density")
    if d is None or d["value"] is None:
        raise CalcBlock("DENSITY_REQUIRED", "activity.density")
    return d


def convert_for_factor(act: dict, factor: dict, trace: list, state: dict) -> tuple[Decimal, str | None]:
    """Faaliyet miktarını faktörün payda birimine çevirir; (miktar, esas) döner."""
    q = act["quantity"]
    q_unit = act["unit"]
    q_family = U.unit_family(q_unit)
    f_unit = factor["denominator_unit"]
    f_family = U.unit_family(f_unit)
    f_cond_field = factor["field"] + ".reference_conditions"

    if q_family == U.ENERGY:
        if f_family != U.ENERGY:
            raise CalcBlock("UNIT_INCOMPATIBLE", "activity.unit", f"enerji ({q_unit}) → {f_unit}")
        converted, ratio = U.convert_energy(q, q_unit, f_unit)
        _emit_conversion(trace, state, ("unit", f_unit), _fixed_step(q, q_unit, converted, f_unit, ratio))
        final = _apply_basis(
            converted, f_unit, act["basis"], "activity.heating_value_basis", factor, act, trace, state
        )
        return final, state["effective_basis"]

    if q_family == U.MASS:
        if f_family == U.MASS:
            converted, ratio = U.convert_mass(q, q_unit, f_unit)
            _emit_conversion(trace, state, ("unit", f_unit), _fixed_step(q, q_unit, converted, f_unit, ratio))
            return converted, None
        if f_family == U.VOLUME_LIQUID:
            d = _density(act)
            kg, _ = U.convert_mass(q, q_unit, "kg")
            litres = U.mass_to_liquid(kg, d["value"])
            converted, ratio = U.convert_liquid(litres, "L", f_unit)
            _emit_conversion(
                trace,
                state,
                ("density", f_unit),
                _fixed_step(q, q_unit, converted, f_unit, converted / q if q != 0 else Decimal("0"),
                            f"density {format_decimal(d['value'])} kg/L; kaynak: {d['source_ref']}"),
            )
            return converted, None
        raise CalcBlock("UNIT_INCOMPATIBLE", "activity.unit", f"kütle ({q_unit}) → {f_unit}")

    if q_family == U.VOLUME_LIQUID:
        if f_family == U.VOLUME_LIQUID:
            converted, ratio = U.convert_liquid(q, q_unit, f_unit)
            _emit_conversion(trace, state, ("unit", f_unit), _fixed_step(q, q_unit, converted, f_unit, ratio))
            return converted, None
        if f_family == U.MASS:
            d = _density(act)
            litres, _ = U.convert_liquid(q, q_unit, "L")
            kg = U.liquid_to_mass(litres, d["value"])
            converted, ratio = U.convert_mass(kg, "kg", f_unit)
            _emit_conversion(
                trace,
                state,
                ("density", f_unit),
                _fixed_step(q, q_unit, converted, f_unit, converted / q if q != 0 else Decimal("0"),
                            f"density {format_decimal(d['value'])} kg/L; kaynak: {d['source_ref']}"),
            )
            return converted, None
        raise CalcBlock("UNIT_INCOMPATIBLE", "activity.unit", f"sıvı hacim ({q_unit}) → {f_unit}")

    if q_family == U.CURRENCY:
        if f_family != U.CURRENCY:
            raise CalcBlock("UNIT_INCOMPATIBLE", "activity.unit", f"para ({q_unit}) → {f_unit}")
        if q_unit != f_unit:
            raise CalcBlock("CURRENCY_MISMATCH", factor["field"] + ".denominator_unit", f"{q_unit} ≠ {f_unit}")
        _emit_conversion(trace, state, ("unit", f_unit), _fixed_step(q, q_unit, q, f_unit, Decimal("1"), "aynı para birimi"))
        return q, None

    if q_family in (U.DISTANCE, U.MASS_DISTANCE, U.PASSENGER_DISTANCE, U.COUNT):
        if f_family != q_family:
            raise CalcBlock("UNIT_INCOMPATIBLE", "activity.unit", f"{q_unit} → {f_unit}")
        converted, ratio = U.convert_same_family(q, q_unit, f_unit)
        _emit_conversion(trace, state, ("unit", f_unit), _fixed_step(q, q_unit, converted, f_unit, ratio))
        return converted, None

    # Gaz hacmi miktarı
    q_cond = U.resolve_conditions(q_unit, act["reference_conditions"])
    if q_cond is None:
        raise CalcBlock("UNIT_CONDITIONS_UNKNOWN", "activity.reference_conditions")

    if f_family == U.VOLUME:
        f_cond = U.resolve_conditions(f_unit, factor["reference_conditions"])
        if f_cond is None:
            raise CalcBlock("UNIT_CONDITIONS_UNKNOWN", f_cond_field, "faktörün m3 koşulu yok")
        converted, ratio = U.convert_volume(
            q, q_cond, f_cond, "activity.reference_conditions", f_cond_field
        )
        _emit_conversion(
            trace,
            state,
            ("unit", f_unit, f_cond),
            {
                "step": "unit_conversion",
                "from": f"{format_decimal(q)} {q_unit} ({U.describe_conditions(q_cond)})",
                "to": f"{format_decimal(converted)} {f_unit} ({U.describe_conditions(f_cond)})",
                "ratio": format_decimal(ratio),
                "source": U.IDEAL_GAS_SOURCE if ratio != 1 else "aynı referans koşulu",
            },
        )
        return converted, None

    if f_family == U.ENERGY:
        cv = act["calorific_value"]
        if cv is None:
            raise CalcBlock("CALORIFIC_VALUE_REQUIRED", "activity.calorific_value")
        cv_cond = U.resolve_conditions(cv["volume_unit"], cv["reference_conditions"])
        if cv_cond is None:
            raise CalcBlock(
                "UNIT_CONDITIONS_UNKNOWN",
                "activity.calorific_value.reference_conditions",
                "ısıl değerin m3 koşulu yok",
            )
        volume, v_ratio = U.convert_volume(
            q, q_cond, cv_cond, "activity.reference_conditions", "activity.calorific_value.reference_conditions"
        )
        if v_ratio != 1:
            _emit_conversion(
                trace,
                state,
                ("unit", cv["volume_unit"], cv_cond),
                {
                    "step": "unit_conversion",
                    "from": f"{format_decimal(q)} {q_unit} ({U.describe_conditions(q_cond)})",
                    "to": f"{format_decimal(volume)} {cv['volume_unit']} ({U.describe_conditions(cv_cond)})",
                    "ratio": format_decimal(v_ratio),
                    "source": U.IDEAL_GAS_SOURCE,
                },
            )
        energy = volume * cv["value"]
        _emit_conversion(
            trace,
            state,
            ("calorific", cv["energy_unit"]),
            {
                "step": "unit_conversion",
                "from": f"{format_decimal(volume)} {cv['volume_unit']}",
                "to": f"{format_decimal(energy)} {cv['energy_unit']}",
                "ratio": format_decimal(cv["value"]),
                "source": f"calorific_value {format_decimal(cv['value'])} {cv['energy_unit']}/{cv['volume_unit']} "
                f"({cv['basis'] or 'esas yok'}); kaynak: {cv['source_ref']}",
            },
        )
        converted, e_ratio = U.convert_energy(energy, cv["energy_unit"], f_unit)
        if cv["energy_unit"] != f_unit:
            _emit_conversion(
                trace, state, ("unit", f_unit), _fixed_step(energy, cv["energy_unit"], converted, f_unit, e_ratio)
            )
        final = _apply_basis(
            converted, f_unit, cv["basis"], "activity.calorific_value.basis", factor, act, trace, state
        )
        return final, state["effective_basis"]

    raise CalcBlock("UNIT_INCOMPATIBLE", "activity.unit", f"hacim ({q_unit}) → {f_unit}")


# --------------------------------------------------------------------------- #
# Kapsama
# --------------------------------------------------------------------------- #


def coverage_of(gases: set[str]) -> tuple[str, str]:
    if gases == {"CO2e"}:
        return "co2e_factor", CLAIM_TR["co2e_factor"]
    if gases == {"CO2"}:
        return "co2_only", CLAIM_TR["co2_only"]
    if gases == set(GHG_GASES):
        return "full_ghg", CLAIM_TR["full_ghg"]
    present = ", ".join(GAS_LABEL_TR[g] for g in GHG_GASES if g in gases)
    missing = ", ".join(GAS_LABEL_TR[g] for g in GHG_GASES if g not in gases)
    return "partial_ghg", CLAIM_TR["partial_ghg"].format(present=present, missing=missing)


# --------------------------------------------------------------------------- #
# Gaz bazlı hesap
# --------------------------------------------------------------------------- #


def new_state() -> dict:
    return {"emitted": set(), "basis_conversion_used": False, "effective_basis": None, "basis_check": None}


def compute(act: dict, factors: list[dict], gwp: dict, trace: list, v: Validator, state: dict | None = None) -> dict | None:
    """Doğrulanmış faaliyet × faktör listesi → bileşenler ve toplam.

    Engel oluşursa `v.blocks`'a yazar ve None döner. Dönen sözlük:
    components, total (Decimal), coverage, claim_tr, normalized_activity,
    basis_conversion_used.
    """
    if state is None:
        state = new_state()
    converted: list[tuple[dict, Decimal, str | None]] = []
    for f in factors:
        state["basis_check"] = None
        try:
            qty, basis = convert_for_factor(act, f, trace, state)
        except CalcBlock as exc:
            v.blocks.append(exc.to_block())
            continue
        match_step = {
            "step": "factor_match",
            "factor_id": f["id"],
            "factor_version": f["version"],
            "boundary": f["boundary"],
        }
        if state["basis_check"] is not None:
            match_step["basis_check"] = state["basis_check"]
        trace.append(match_step)
        converted.append((f, qty, basis))
    if v.blocks:
        return None

    components: list[dict] = []
    total = Decimal("0")
    for f, qty, _basis in converted:
        mass = qty * f["value"]
        formula = f"{format_decimal(qty)} × {format_decimal(f['value'])}"
        if f["numerator_unit"] != "kg":
            mass_kg, m_ratio = U.convert_mass(mass, f["numerator_unit"], "kg")
            formula += f" × {format_decimal(m_ratio)}"
        else:
            mass_kg = mass
        trace.append(
            {
                "step": "gas_calculation",
                "gas": f["gas"],
                "factor_id": f["id"],
                "formula": f"{formula} = {format_decimal(mass_kg)} kg",
            }
        )

        gwp_value: Decimal | None = None
        applied = False
        if f["gas"] in ("CH4", "N2O"):
            gwp_value = gwp["values"][f["gas"]]
            applied = True
            co2e = mass_kg * gwp_value
            trace.append(
                {
                    "step": "gwp",
                    "gas": f["gas"],
                    "applied": True,
                    "gwp": format_decimal(gwp_value),
                    "gwp_set_id": gwp["id"],
                    "formula": f"{format_decimal(mass_kg)} × {format_decimal(gwp_value)} = {format_decimal(co2e)} kg CO2e",
                }
            )
        else:
            co2e = mass_kg
            reason = (
                "CO2 için GWP 1; CO2e faktöre GWP uygulanmaz"
                if f["gas"] == "CO2"
                else "faktör zaten CO2e; GWP ikinci kez uygulanmaz"
            )
            trace.append({"step": "gwp", "gas": f["gas"], "applied": False, "reason": reason})

        total += co2e
        components.append(
            {
                "gas": f["gas"],
                "factor_id": f["id"],
                "factor_version": f["version"],
                "mass_kg": format_decimal(mass_kg),
                "gwp": format_decimal(gwp_value) if gwp_value is not None else None,
                "gwp_applied": applied,
                "co2e_kg": format_decimal(co2e),
            }
        )

    coverage, claim_tr = coverage_of({f["gas"] for f in factors})
    first_factor, first_qty, first_basis = converted[0]
    return {
        "components": components,
        "total": total,
        "coverage": coverage,
        "claim_tr": claim_tr,
        "normalized_activity": {
            "quantity": format_decimal(first_qty),
            "unit": first_factor["denominator_unit"],
            "basis": first_basis,
        },
        "basis_conversion_used": state["basis_conversion_used"],
    }


def quality_warnings(act: dict, basis_conversion_used: bool, warnings: list[dict]) -> str:
    """0.1 kalite durumu: esas dönüşümü veya tahmini veri → review_required."""
    status = "computed"
    if basis_conversion_used:
        status = "review_required"
        warnings.append(warning("BASIS_CONVERSION_APPLIED"))
    if act["data_quality"] == "estimated":
        status = "review_required"
        warnings.append(warning("DATA_QUALITY_ESTIMATED"))
    return status


# --------------------------------------------------------------------------- #
# Yanıt biçimi
# --------------------------------------------------------------------------- #


def response(
    *,
    method: dict,
    status: str,
    blocks: list,
    warnings: list,
    normalized_activity: dict | None,
    components: list,
    total: str | None,
    coverage: str | None,
    claim_tr: str,
    boundary: str | None,
    trace: list,
    hash_value: str | None,
    context: str = "corporate",
    scope: int | None = 1,
    value_state: str = "known",
    extra: dict | None = None,
) -> dict:
    out = {
        "engine_version": ENGINE_VERSION,
        "method": method,
        "status": status,
        "blocks": blocks,
        "warnings": warnings,
        "normalized_activity": normalized_activity,
        "components": components,
        "total_co2e_kg": total,
        "coverage": coverage,
        "claim_tr": claim_tr,
        "boundary": boundary,
        "trace": trace,
        "inputs_hash": hash_value,
        "context": context,
        "scope": scope,
        "value_state": value_state,
    }
    if extra:
        out.update(extra)
    return out


def blocked(
    method: dict,
    blocks: list,
    trace: list,
    boundary: str | None,
    hash_value: str | None,
    *,
    context: str = "corporate",
    scope: int | None = 1,
    value_state: str = "known",
    extra: dict | None = None,
) -> dict:
    trace = list(trace) + [{"step": "result", "total_co2e_kg": None, "coverage": None, "status": "blocked"}]
    return response(
        method=method,
        status="blocked",
        blocks=blocks,
        warnings=[],
        normalized_activity=None,
        components=[],
        total=None,
        coverage=None,
        claim_tr=CLAIM_TR["blocked"],
        boundary=boundary,
        trace=trace,
        hash_value=hash_value,
        context=context,
        scope=scope,
        value_state=value_state,
        extra=extra,
    )


def result_step(total: Decimal | None, coverage: str | None, status: str, **extra) -> dict:
    step = {
        "step": "result",
        "total_co2e_kg": format_decimal(total) if total is not None else None,
        "coverage": coverage,
        "status": status,
    }
    step.update(extra)
    return step
