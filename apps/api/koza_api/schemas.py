"""İstek şemaları (pydantic v2). Tümü `extra="forbid"`: gövdede `tenant_id` gelirse 422 (kural 3).

Sayılar ondalık DİZE olarak alınır (`"100"`, `"0"`, `"38.5"`); JSON sayısı 422 ile reddedilir
(motor sözleşmesiyle aynı: sessiz dönüşüm yok). Kural 2: `quantity` NULL + `quantity_state`
birlikte okunur; `not_applicable` için gerekçe zorunludur.
"""

from __future__ import annotations

from datetime import date, datetime
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


# ---------------------------------------------------------------------------
# Dilim 1 ekleri
# ---------------------------------------------------------------------------

ControlRelation = Literal["owned", "leased_operational_control", "leased_financial_control", "leased_no_control",
                          "third_party", "unknown"]


class ClassificationPreviewRequest(Strict):
    source_type: str = Field(min_length=1)
    fuel: str | None = None
    control_relation: ControlRelation | None = None
    energy_carrier: str | None = Field(default=None, description="purchased_* için: electricity | steam | heat | cooling")
    scope3_hint: str | None = Field(default=None, description="scope3 için ipucu: purchased_goods | business_travel | ...")


class ImportRows(Strict):
    """JSON ile içe aktarma: satırlar ActivityCreate alanlarını (period_id hariç) taşır."""

    period_id: str
    rows: list[dict[str, Any]] = Field(min_length=1, max_length=5000)
    filename: str | None = Field(default=None, max_length=255)


class ImportRollbackRequest(Strict):
    reason: str = Field(min_length=10, max_length=2000)


class SourceCreate(Strict):
    name: str = Field(min_length=1, max_length=300)
    publisher: str = Field(min_length=1, max_length=300)
    url: str | None = Field(default=None, max_length=2000)
    kind: Literal["standard", "methodology", "regulation", "dataset", "guidance"]
    license: str | None = Field(default=None, max_length=300)


class ChangeCard(Strict):
    """§19 değişiklik kartı."""

    old_link: str | None = None
    new_link: str | None = None
    changed_clause: str | None = None
    summary_tr: str | None = None
    nature: Literal["definitive", "interpretive"] | None = Field(default=None, description="kesin / yorum niteliği")
    affected_profiles: list[str] = Field(default_factory=list)
    affected_forms: list[str] = Field(default_factory=list)
    affected_calculations: list[str] = Field(default_factory=list)
    affected_lessons: list[str] = Field(default_factory=list)
    effective_note_tr: str | None = Field(default=None, description="Hangi tarihten itibaren hangi iş değişir")


class SourceVersionCreate(Strict):
    """Tarih modeli (§19): yayın, yürürlük, kapsanan dönem, erken uygulama, görülme, son kontrol — ayrı alanlar."""

    publication_date: date | None = None
    effective_date: date | None = None
    covered_period_start: date | None = None
    covered_period_end: date | None = None
    early_adoption_note: str | None = None
    seen_at: datetime | None = Field(default=None, description="Sistemde görülme; boşsa şimdi")
    last_checked_at: datetime | None = None
    content_hash: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$", description="İçerik sha256; `content` verilirse hesaplanır")
    content: str | None = Field(default=None, description="Karma hesaplamak için ham metin (saklanmaz)")
    content_url: str | None = Field(default=None, max_length=2000)
    change_card: ChangeCard = Field(default_factory=ChangeCard)

    @model_validator(mode="after")
    def _validate(self) -> "SourceVersionCreate":
        if self.content_hash is None and self.content is None:
            raise ValueError("content_hash veya content zorunlu (SRC-03)")
        if self.covered_period_start and self.covered_period_end and self.covered_period_end < self.covered_period_start:
            raise ValueError("covered_period_end, covered_period_start'tan önce olamaz")
        return self


class FactorVersionCreate(Strict):
    version: str = Field(min_length=1, max_length=50)
    value: DecimalStr
    numerator_unit: str = Field(min_length=1)
    gas: Literal["CO2", "CH4", "N2O", "CO2e"]
    denominator_unit: str = Field(min_length=1)
    basis: Basis | None = None
    reference_conditions: dict[str, Any] | None = None
    boundary: str = Field(min_length=1)
    gwp_set_id: str | None = None
    country: str | None = None
    year: int | None = None
    source_ref: str = Field(min_length=3, description="Zorunlu: yayımlayan kaynak / sürüm referansı (§18)")
    license: str = Field(min_length=1)
    valid_from: date
    valid_to: date | None = None

    @model_validator(mode="after")
    def _validate(self) -> "FactorVersionCreate":
        if not self.source_ref.strip():
            raise ValueError("source_ref boş olamaz")
        if self.value.startswith("-"):
            raise ValueError("Faktör değeri negatif olamaz")
        return self


class AggregatePolicy(Strict):
    include_states: list[Literal["draft", "validation_required", "calculated", "in_review", "changes_requested", "approved", "locked"]] = Field(
        default_factory=lambda: ["approved", "locked"]
    )
    scope2_method: Literal["location_based", "market_based"] = "location_based"


class AggregateRequest(Strict):
    period_id: str
    policy: AggregatePolicy = Field(default_factory=AggregatePolicy)


class WebhookRow(Strict):
    external_id: str = Field(min_length=1, max_length=200)
    payload: dict[str, Any]
    pulled_at: datetime | None = None


class WebhookEvent(Strict):
    event_id: str = Field(min_length=1, max_length=200)
    mapping_version: str = Field(min_length=1, max_length=50)
    pulled_at: datetime | None = None
    rows: list[WebhookRow] = Field(min_length=1, max_length=5000)


class SessionRevokeRequest(Strict):
    jti: str | None = Field(default=None, description="Boşsa mevcut oturum; başka jti yalnız admin")
    reason: str | None = Field(default=None, max_length=500)


class MembershipChange(Strict):
    user_id: str
    role: Literal["admin", "data_entry", "data_owner", "reviewer", "approver", "viewer", "supplier", "content_editor"]
    action: Literal["grant", "revoke"]
    reason: str | None = Field(default=None, max_length=500)
