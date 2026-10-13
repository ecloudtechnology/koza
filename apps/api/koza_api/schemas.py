"""İstek şemaları (pydantic v2). Tümü `extra="forbid"`: gövdede `tenant_id` gelirse 422 (kural 3).

Sayılar ondalık DİZE olarak alınır (`"100"`, `"0"`, `"38.5"`); JSON sayısı 422 ile reddedilir
(motor sözleşmesiyle aynı: sessiz dönüşüm yok). Kural 2: `quantity` NULL + `quantity_state`
birlikte okunur; `not_applicable` için gerekçe zorunludur.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Any, ClassVar, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

DecimalStr = Annotated[str, Field(strict=True, pattern=r"^-?\d+(\.\d+)?$", description="Ondalık dize; sayı değil")]
QuantityState = Literal["known", "unknown", "not_applicable"]
DataQuality = Literal["measured", "estimated"]
Basis = Literal["LHV", "HHV"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


def _check_value_state(quantity: str | None, state: str, reason: str | None) -> None:
    errors = []
    if state == "known" and quantity is None:
        errors.append("quantity_state=known için quantity zorunludur")
    if state != "known" and quantity is not None:
        errors.append("quantity yalnız quantity_state=known ile verilir (bilinmiyor/uygulanamaz için NULL)")
    if state == "not_applicable" and not (reason and reason.strip()):
        errors.append("not_applicable için not_applicable_reason zorunludur")
    if state != "not_applicable" and reason:
        errors.append("not_applicable_reason yalnız not_applicable ile verilir")
    if quantity is not None and quantity.startswith("-"):
        errors.append("Miktar negatif olamaz; iade/düzeltme ayrı işlem türüdür")
    if errors:
        raise ValueError("; ".join(errors))


class ActivityCreate(Strict):
    period_id: str
    source_type: str = Field(min_length=1)
    fuel: str | None = None
    quantity: DecimalStr | None = None
    quantity_state: QuantityState = "unknown"
    not_applicable_reason: str | None = None
    unit: str | None = None
    heating_value_basis: Basis | None = None
    data_quality: DataQuality = "measured"
    activity_start: date
    activity_end: date
    note: str | None = None
    source_id: str | None = None

    @model_validator(mode="after")
    def _validate(self) -> "ActivityCreate":
        _check_value_state(self.quantity, self.quantity_state, self.not_applicable_reason)
        if self.activity_end < self.activity_start:
            raise ValueError("activity_end, activity_start'tan önce olamaz")
        return self


class ActivityPatch(Strict):
    """Kısmi güncelleme. Verilmeyen alan korunur; açık `null` 'bilinmiyor' demektir
    (pydantic `model_fields_set` ile ayırt edilir)."""

    expected_version: int | None = Field(default=None, description="If-Match başlığına alternatif")
    change_reason: str | None = None
    fuel: str | None = None
    quantity: DecimalStr | None = None
    quantity_state: QuantityState | None = None
    not_applicable_reason: str | None = None
    unit: str | None = None
    heating_value_basis: Basis | None = None
    data_quality: DataQuality | None = None
    activity_start: date | None = None
    activity_end: date | None = None
    note: str | None = None

    DATA_FIELDS: ClassVar[tuple[str, ...]] = ("fuel", "quantity", "quantity_state", "not_applicable_reason", "unit",
                   "heating_value_basis", "data_quality", "activity_start", "activity_end", "note")
    NOT_NULLABLE: ClassVar[tuple[str, ...]] = ("quantity_state", "data_quality", "activity_start", "activity_end")

    @model_validator(mode="after")
    def _validate(self) -> "ActivityPatch":
        for name in self.NOT_NULLABLE:
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} null olamaz")
        return self

    def changes(self) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for name in self.DATA_FIELDS:
            if name in self.model_fields_set:
                val = getattr(self, name)
                out[name] = val.isoformat() if isinstance(val, date) else val
        return out


class FactorRef(Strict):
    id: str
    version: str


class MethodRef(Strict):
    id: str
    version: str


class CalculateRequest(Strict):
    factor_refs: list[FactorRef] = Field(min_length=1)
    method: MethodRef
    calorific_value: dict[str, Any] | None = None
    basis_conversion: dict[str, Any] | None = None
    reference_conditions: dict[str, Any] | None = None


class PreviewActivity(Strict):
    source_type: str
    fuel: str | None = None
    quantity: DecimalStr
    unit: str
    heating_value_basis: Basis | None = None
    data_quality: DataQuality = "measured"
    activity_start: date
    activity_end: date


class PreviewRequest(Strict):
    activity: PreviewActivity
    factor_refs: list[FactorRef] = Field(min_length=1)
    method: MethodRef
    calorific_value: dict[str, Any] | None = None
    basis_conversion: dict[str, Any] | None = None
    reference_conditions: dict[str, Any] | None = None


class SubmitRequest(Strict):
    note: str | None = None


class ApprovalRequest(Strict):
    record_id: str
    expected_version: int
    decision: Literal["approve", "request_changes"]
    comment: str | None = None
    self_approval_reason: str | None = None


class PeriodCreate(Strict):
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def _validate(self) -> "PeriodCreate":
        if self.end_date < self.start_date:
            raise ValueError("end_date, start_date'ten önce olamaz")
        return self


class PeriodLockRequest(Strict):
    note: str | None = None


class PeriodReopenRequest(Strict):
    reason: str
    impact_note: str | None = None


class ReportCreate(Strict):
    period_id: str
    supersede_reason: str | None = Field(default=None, description="Önceki rapor sürümü varsa neden yenilendiği")


class EvidenceUploadRequest(Strict):
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    filename: str = Field(min_length=1, max_length=255)
    size_bytes: int = Field(ge=0)
    record_id: str | None = None
