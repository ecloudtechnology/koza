"""§21 kayıt durum makinesi + §04 rol kontrolleri. Yetki yalnız burada ve sunucuda verilir (kural 4).

Durumlar: draft → validation_required → calculated → in_review → changes_requested | approved → locked

Kurallar:
- Veri değişikliği (PATCH) yeni sürüm ekler; onaylı/hesaplanmış kayıt `validation_required`'a döner
  (önceki onay geçersizleşir, §21). Taslak taslak kalır.
- `calculated` onaylandı demek değildir. Hesap koşumu bloke olduysa durum değişmez.
- Onaylayan ≠ yazar (görevlerin ayrılığı). Kurum politikası `allow_self_approval` ise gerekçeyle izin verilir.
- Kilitli dönemdeki kayıt hiçbir şekilde değiştirilemez → 409 PERIOD_LOCKED + yeniden açma yolu (T17).
- Dönem kilidi yalnız admin; yeniden açma yalnız admin ve gerekçe zorunlu.
- Faktör güncellenince eski koşum/onay korunur; onaylı kayıtta yeni koşum "öneri" olarak eklenir (T13).
"""

from __future__ import annotations

from .auth import TenantContext
from .errors import ApiError, forbidden
from .repo import Organization, Period, Record, RecordVersion

# --- durumlar ---------------------------------------------------------------

DRAFT = "draft"
VALIDATION_REQUIRED = "validation_required"
CALCULATED = "calculated"
IN_REVIEW = "in_review"
CHANGES_REQUESTED = "changes_requested"
APPROVED = "approved"
LOCKED = "locked"

STATES = (DRAFT, VALIDATION_REQUIRED, CALCULATED, IN_REVIEW, CHANGES_REQUESTED, APPROVED, LOCKED)

# --- roller (§04) -------------------------------------------------------------

ADMIN = "admin"
DATA_ENTRY = "data_entry"
DATA_OWNER = "data_owner"
REVIEWER = "reviewer"
APPROVER = "approver"
VIEWER = "viewer"

READ_ROLES = frozenset({ADMIN, DATA_ENTRY, DATA_OWNER, REVIEWER, APPROVER, VIEWER})
CREATE_ROLES = frozenset({ADMIN, DATA_ENTRY, DATA_OWNER})
EDIT_ROLES = frozenset({ADMIN, DATA_ENTRY, DATA_OWNER})
EDIT_APPROVED_ROLES = frozenset({ADMIN, DATA_OWNER})  # veri giren onaylı kaydı değiştiremez (§04)
CALCULATE_ROLES = frozenset({ADMIN, DATA_ENTRY, DATA_OWNER, REVIEWER})
SUBMIT_ROLES = frozenset({ADMIN, DATA_ENTRY, DATA_OWNER})
REQUEST_CHANGES_ROLES = frozenset({REVIEWER, APPROVER})
APPROVE_ROLES = frozenset({APPROVER})  # admin teknik onay veremez (§04)
PERIOD_MANAGE_ROLES = frozenset({ADMIN})
REPORT_ROLES = frozenset({ADMIN, APPROVER, REVIEWER})
EVIDENCE_ROLES = frozenset({ADMIN, DATA_ENTRY, DATA_OWNER})
AUDIT_ROLES = frozenset({ADMIN, REVIEWER, APPROVER, VIEWER})

# --- geçiş tabloları ----------------------------------------------------------

EDITABLE_STATES = frozenset({DRAFT, VALIDATION_REQUIRED, CALCULATED, CHANGES_REQUESTED, APPROVED})
CALCULABLE_STATES = frozenset({DRAFT, VALIDATION_REQUIRED, CALCULATED, CHANGES_REQUESTED, APPROVED})
REVIEW_DECISION_STATES = frozenset({IN_REVIEW})


def require_roles(ctx: TenantContext, roles: frozenset[str]) -> None:
    if not ctx.has_any(roles):
        raise forbidden()


def ensure_period_open(period: Period, record: Record | None = None) -> None:
    """Kilitli dönem: 409 PERIOD_LOCKED, yeniden açma yolu ile (T17)."""
    if period.status == "locked":
        raise ApiError(
            409,
            "PERIOD_LOCKED",
            "Dönem kilitli; değişiklik için yetkili yeniden açma akışı gerekir.",
            details={
                "period_id": period.id,
                "reopen_path": f"/v1/periods/{period.id}/reopen",
                "required_role": ADMIN,
                "reason_required": True,
            },
        )


def state_conflict(current: str, action: str) -> ApiError:
    return ApiError(
        409,
        "STATE_CONFLICT",
        f"Kayıt '{current}' durumundayken '{action}' yapılamaz.",
        details={"current_state": current, "action": action},
    )


def check_edit(ctx: TenantContext, record: Record, period: Period) -> str:
    """PATCH izni ve sonraki durum. Döner: yeni sürümün durumu."""
    ensure_period_open(period, record)
    current = record.current
    if current.state == APPROVED:
        require_roles(ctx, EDIT_APPROVED_ROLES)
    else:
        require_roles(ctx, EDIT_ROLES)
    if current.state not in EDITABLE_STATES:
        raise state_conflict(current.state, "update")
    if current.state == DRAFT:
        return DRAFT
    # hesaplanmış / onaylı / düzeltme istenmiş veride değişiklik → yeniden doğrulama (§21)
    return VALIDATION_REQUIRED


def approval_invalidated_by_edit(current: RecordVersion) -> bool:
    return current.state == APPROVED


def check_calculate(ctx: TenantContext, record: Record, period: Period) -> None:
    ensure_period_open(period, record)
    require_roles(ctx, CALCULATE_ROLES)
    current = record.current
    if current.state not in CALCULABLE_STATES:
        raise state_conflict(current.state, "calculate")
    if current.quantity_state != "known":
        raise ApiError(
            422,
            "QUANTITY_NOT_KNOWN",
            "Miktar bilinmiyor veya uygulanamaz olarak işaretli; hesap yapılamaz. Eksik veriye sıfır atanmaz.",
            field_errors=[{"field": "quantity", "message": "Bilinen bir miktar gerekli."}],
        )


def state_after_calculate(current: RecordVersion, engine_status: str) -> str | None:
    """Döner: yeni durum ya da None (durum değişmez, yalnız koşum eklenir)."""
    if engine_status == "blocked":
        return None
    if current.state == APPROVED:
        # T13: onaylı sonuç korunur, yeni koşum öneri olarak listelenir; onay durumu değişmez
        return None
    return CALCULATED


def check_submit(ctx: TenantContext, record: Record, period: Period, has_valid_run: bool) -> None:
    ensure_period_open(period, record)
    require_roles(ctx, SUBMIT_ROLES)
    current = record.current
    if current.quantity_state == "not_applicable" and current.state in (DRAFT, VALIDATION_REQUIRED, CHANGES_REQUESTED):
        return  # gerekçeli "uygulanamaz" kaydı hesapsız incelemeye gidebilir
    if current.state != CALCULATED:
        raise state_conflict(current.state, "submit")
    if not has_valid_run:
        raise ApiError(409, "CALCULATION_STALE", "Güncel veri sürümü için geçerli hesap koşumu yok; önce hesaplayın.")


def check_review_decision(
    ctx: TenantContext,
    record: Record,
    period: Period,
    org: Organization,
    decision: str,
    self_approval_reason: str | None,
) -> bool:
    """Onay / düzeltme kararı izni. Döner: self_approval bayrağı."""
    ensure_period_open(period, record)
    current = record.current
    if current.state not in REVIEW_DECISION_STATES:
        raise state_conflict(current.state, decision)
    if decision == "approve":
        require_roles(ctx, APPROVE_ROLES)
    elif decision == "request_changes":
        require_roles(ctx, REQUEST_CHANGES_ROLES)
    else:
        raise ApiError(422, "VALIDATION_ERROR", "Geçersiz karar.", field_errors=[{"field": "decision", "message": "approve | request_changes"}])

    if decision != "approve":
        return False

    # görevlerin ayrılığı: yazar (veri sürümünün yazarı veya kaydı açan) onaylayamaz
    authors = {record.created_by} | {v.author_id for v in record.versions if v.transition in ("create", "update")}
    if ctx.user_id in authors:
        if not org.policy.get("allow_self_approval", False):
            raise ApiError(
                403,
                "SELF_APPROVAL_FORBIDDEN",
                "Veri giren ile onaylayan farklı olmalıdır (kurum politikası).",
                details={"policy": "allow_self_approval=false"},
            )
        if not self_approval_reason or len(self_approval_reason.strip()) < 10:
            raise ApiError(
                422,
                "SELF_APPROVAL_REASON_REQUIRED",
                "Kendi kaydınızı onaylamak için gerekçe zorunludur.",
                field_errors=[{"field": "self_approval_reason", "message": "En az 10 karakter."}],
            )
        return True
    return False


def check_lock(ctx: TenantContext, period: Period, records: list[Record]) -> None:
    require_roles(ctx, PERIOD_MANAGE_ROLES)
    if period.status == "locked":
        raise ApiError(409, "PERIOD_ALREADY_LOCKED", "Dönem zaten kilitli.")
    not_ready = [r.id for r in records if r.current.state != APPROVED]
    if not_ready:
        raise ApiError(
            409,
            "PERIOD_NOT_READY",
            "Dönemde onaylanmamış kayıt var; kilitlenemez.",
            details={"records_not_approved": sorted(not_ready)},
        )


def check_reopen(ctx: TenantContext, period: Period, reason: str | None) -> None:
    require_roles(ctx, PERIOD_MANAGE_ROLES)
    if period.status != "locked":
        raise ApiError(409, "PERIOD_NOT_LOCKED", "Dönem kilitli değil; yeniden açma gerekmez.")
    if not reason or len(reason.strip()) < 10:
        raise ApiError(
            422,
            "REASON_REQUIRED",
            "Yeniden açma için gerekçe zorunludur.",
            field_errors=[{"field": "reason", "message": "En az 10 karakter."}],
        )
