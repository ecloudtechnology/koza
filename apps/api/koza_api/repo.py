"""Depo katmanı.

Her okuma/yazma `(tenant_id, id)` anahtarıyla yapılır; yabancı kurumun nesnesi `None` döner ve
yönlendirici 404 verir (403 değil — varlık açıklanmaz, §27). Bu, DB'deki RLS'nin uygulama
içi karşılığıdır; ikisi birlikte çalışır (kural 3).

Sürüm, koşum, onay, rapor ve audit satırları yalnız EKLENİR; depo arayüzünde update/delete yoktur.
İçe aktarma geri alması taslak kaydı "geri çeker" (withdrawn_*); sürüm satırlarına dokunmaz.

İki uygulama: `InMemoryRepo` (bu dosya) ve `PostgresRepo` (`repo_postgres.py`, psycopg v3, RLS).
Seçim `KOZA_DATABASE_URL` ile (`main.py`).
"""

from __future__ import annotations

import itertools
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


# ---------------------------------------------------------------------------
# Varlıklar
# ---------------------------------------------------------------------------


@dataclass
class Organization:
    id: str
    name: str
    policy: dict[str, Any] = field(default_factory=dict)  # {"allow_self_approval": bool}
    country: str = "TR"


@dataclass
class User:
    id: str
    email: str
    display_name: str
    oidc_subject: str | None = None
    disabled_at: str | None = None


@dataclass
class Period:
    id: str
    tenant_id: str
    start_date: str
    end_date: str
    status: str = "open"  # open | closing | locked
    locked_at: str | None = None
    locked_by: str | None = None
    created_at: str = field(default_factory=utcnow_iso)


@dataclass
class PeriodReopen:
    id: str
    tenant_id: str
    period_id: str
    reason: str
    impact_note: str | None
    requested_by: str
    approved_by: str
    created_at: str = field(default_factory=utcnow_iso)


@dataclass
class RecordVersion:
    tenant_id: str
    record_id: str
    version: int
    data_version: int
    state: str
    source_type: str
    fuel: str | None
    quantity: str | None  # ondalık dize; NULL = bilinmiyor
    quantity_state: str  # known | unknown | not_applicable
    not_applicable_reason: str | None
    unit: str | None
    heating_value_basis: str | None
    data_quality: str
    activity_start: str
    activity_end: str
    note: str | None
    author_id: str
    transition: str
    change_reason: str | None
    created_at: str = field(default_factory=utcnow_iso)

    DATA_FIELDS = (
        "source_type",
        "fuel",
        "quantity",
        "quantity_state",
        "not_applicable_reason",
        "unit",
        "heating_value_basis",
        "data_quality",
        "activity_start",
        "activity_end",
        "note",
    )

    def data(self) -> dict[str, Any]:
        return {f: getattr(self, f) for f in self.DATA_FIELDS}


@dataclass
class Record:
    id: str
    tenant_id: str
    period_id: str
    source_id: str | None
    created_by: str
    created_at: str = field(default_factory=utcnow_iso)
    versions: list[RecordVersion] = field(default_factory=list)
    import_job_id: str | None = None
    row_hash: str | None = None
    withdrawn_at: str | None = None
    withdrawn_by: str | None = None
    withdrawn_reason: str | None = None

    @property
    def current(self) -> RecordVersion:
        return self.versions[-1]


@dataclass
class CalculationRun:
    id: str
    tenant_id: str
    record_id: str
    record_version: int
    data_version: int
    method_id: str
    method_version: str
    engine_version: str
    factor_refs: list[dict[str, str]]
    request: dict[str, Any]
    inputs_hash: str
    status: str
    result: dict[str, Any]
    run_by: str
    created_at: str = field(default_factory=utcnow_iso)


@dataclass
class Approval:
    id: str
    tenant_id: str
    record_id: str
    record_version: int
    run_id: str | None
    decision: str  # approved | changes_requested
    decided_by: str
    comment: str | None
    self_approval: bool
    self_approval_reason: str | None
    created_at: str = field(default_factory=utcnow_iso)


@dataclass
class Evidence:
    id: str
    tenant_id: str
    sha256: str
    filename: str
    size_bytes: int
    record_id: str | None
    uploaded_by: str
    scan_status: str = "pending"  # pending | clean | rejected
    object_key: str | None = None
    content_type: str | None = None
    created_at: str = field(default_factory=utcnow_iso)


@dataclass
class ReportSnapshot:
    id: str
    tenant_id: str
    period_id: str
    version: int
    manifest: dict[str, Any]
    manifest_sha256: str
    supersedes_id: str | None
    supersede_reason: str | None
    created_by: str
    created_at: str = field(default_factory=utcnow_iso)


@dataclass
class AuditEvent:
    id: int
    tenant_id: str
    actor_id: str | None
    action: str
    object_type: str
    object_id: str | None
    object_version: int | None
    reason: str | None
    request_id: str | None
    payload: dict[str, Any]
    occurred_at: str = field(default_factory=utcnow_iso)


@dataclass
class IdempotencyEntry:
    request_hash: str
    status_code: int
    response: dict[str, Any]


@dataclass
class ImportJob:
    id: str
    tenant_id: str
    period_id: str
    filename: str | None
    file_sha256: str
    mode: str  # preview | apply
    status: str  # preview | done | rolled_back
    summary: dict[str, Any]
    rows: list[dict[str, Any]]  # [{row_no, row_hash, status, record_id, errors}]
    created_by: str
    created_at: str = field(default_factory=utcnow_iso)
    rolled_back_at: str | None = None
    rolled_back_by: str | None = None


@dataclass
class ReferenceSource:
    id: str
    name: str
    publisher: str
    url: str | None
    kind: str
    license: str | None
    created_by: str
    created_at: str = field(default_factory=utcnow_iso)


@dataclass
class ReferenceSourceVersion:
    source_id: str
    version: int
    publication_date: str | None
    effective_date: str | None
    covered_period_start: str | None
    covered_period_end: str | None
    early_adoption_note: str | None
    seen_at: str
    last_checked_at: str | None
    content_hash: str
    content_url: str | None
    change_card: dict[str, Any]
    expert_approved: bool
    approved_by: str | None
    approved_at: str | None
    created_by: str
    created_at: str = field(default_factory=utcnow_iso)


@dataclass
class StagingRow:
    id: str
    tenant_id: str
    source_system: str
    external_id: str
    event_id: str
    pulled_at: str | None
    mapping_version: str
    payload: dict[str, Any]
    status: str = "pending"
    request_id: str | None = None
    received_at: str = field(default_factory=utcnow_iso)


@dataclass
class RevokedToken:
    jti: str
    user_id: str | None
    reason: str | None
    expires_at: str | None
    revoked_at: str = field(default_factory=utcnow_iso)


# ---------------------------------------------------------------------------
# Protokol
# ---------------------------------------------------------------------------


class Repository(Protocol):
    # kurum / kullanıcı / üyelik
    def get_organization(self, tenant_id: str) -> Organization | None: ...
    def get_user(self, user_id: str) -> User | None: ...
    def get_user_by_subject(self, subject: str) -> User | None: ...
    def get_user_by_email(self, email: str) -> User | None: ...
    def get_membership_roles(self, tenant_id: str, user_id: str) -> frozenset[str]: ...
    def list_memberships(self, tenant_id: str) -> list[dict[str, Any]]: ...
    def add_membership(self, tenant_id: str, user_id: str, role: str, granted_by: str | None) -> None: ...
    def revoke_membership(self, tenant_id: str, user_id: str, role: str) -> bool: ...

    # oturum (§25)
    def is_token_revoked(self, jti: str) -> bool: ...
    def revoke_token(self, token: RevokedToken) -> None: ...
    def mark_session_seen(self, tenant_id: str, jti: str, user_id: str) -> bool: ...

    # dönem
    def add_period(self, period: Period) -> None: ...
    def get_period(self, tenant_id: str, period_id: str) -> Period | None: ...
    def list_periods(self, tenant_id: str) -> list[Period]: ...
    def set_period_status(self, tenant_id: str, period_id: str, status: str, actor: str | None) -> Period: ...
    def add_period_reopen(self, reopen: PeriodReopen) -> None: ...
    def list_period_reopens(self, tenant_id: str, period_id: str) -> list[PeriodReopen]: ...

    # kayıt
    def add_record(self, record: Record) -> None: ...
    def get_record(self, tenant_id: str, record_id: str) -> Record | None: ...
    def list_records(self, tenant_id: str, period_id: str | None = None) -> list[Record]: ...
    def append_version(self, version: RecordVersion) -> None: ...
    def find_record_by_row_hash(self, tenant_id: str, row_hash: str) -> Record | None: ...
    def withdraw_record(self, tenant_id: str, record_id: str, by: str, reason: str) -> Record: ...

    # hesap
    def add_run(self, run: CalculationRun) -> None: ...
    def get_run(self, tenant_id: str, run_id: str) -> CalculationRun | None: ...
    def list_runs(self, tenant_id: str, record_id: str) -> list[CalculationRun]: ...

    # onay
    def add_approval(self, approval: Approval) -> None: ...
    def list_approvals(self, tenant_id: str, record_id: str) -> list[Approval]: ...

    # kanıt
    def add_evidence(self, evidence: Evidence) -> None: ...
    def get_evidence(self, tenant_id: str, evidence_id: str) -> Evidence | None: ...
    def find_evidence_by_hash(self, tenant_id: str, sha256: str) -> list[Evidence]: ...
    def update_evidence_object(self, tenant_id: str, evidence_id: str, *, object_key: str | None,
                               content_type: str | None, scan_status: str) -> Evidence: ...

    # rapor
    def add_report(self, report: ReportSnapshot) -> None: ...
    def get_report(self, tenant_id: str, report_id: str) -> ReportSnapshot | None: ...
    def list_reports(self, tenant_id: str, period_id: str) -> list[ReportSnapshot]: ...

    # audit (append-only)
    def append_audit(self, event: AuditEvent) -> AuditEvent: ...
    def list_audit(self, tenant_id: str, object_id: str | None = None, limit: int = 100) -> list[AuditEvent]: ...

    # idempotency
    def get_idempotency(self, tenant_id: str, user_id: str, endpoint: str, key: str) -> IdempotencyEntry | None: ...
    def put_idempotency(self, tenant_id: str, user_id: str, endpoint: str, key: str, entry: IdempotencyEntry) -> None: ...

    # içe aktarma
    def add_import_job(self, job: ImportJob) -> None: ...
    def get_import_job(self, tenant_id: str, job_id: str) -> ImportJob | None: ...
    def find_import_job_by_sha(self, tenant_id: str, file_sha256: str) -> ImportJob | None: ...
    def update_import_job(self, job: ImportJob) -> None: ...

    # katalog (platform düzeyi; kural 12: test faktörleri yalnız testlerde yüklenir)
    def get_factor(self, factor_id: str, version: str) -> dict[str, Any] | None: ...
    def add_factor(self, factor: dict[str, Any]) -> None: ...
    def list_factors(self, factor_id: str | None = None, status: str | None = None) -> list[dict[str, Any]]: ...
    def set_factor_status(self, factor_id: str, version: str, status: str, by: str | None) -> dict[str, Any]: ...
    def get_method(self, method_id: str, version: str) -> dict[str, Any] | None: ...
    def list_methods(self) -> list[dict[str, Any]]: ...

    # kaynak kayıt defteri (§19, platform düzeyi)
    def add_source(self, source: ReferenceSource) -> None: ...
    def get_source(self, source_id: str) -> ReferenceSource | None: ...
    def list_sources(self) -> list[ReferenceSource]: ...
    def add_source_version(self, version: ReferenceSourceVersion) -> None: ...
    def list_source_versions(self, source_id: str) -> list[ReferenceSourceVersion]: ...
    def approve_source_version(self, source_id: str, version: int, by: str) -> ReferenceSourceVersion | None: ...
    def touch_source_version_checked(self, source_id: str, version: int) -> ReferenceSourceVersion | None: ...

    # entegrasyon staging (§27)
    def add_staging_row(self, row: StagingRow) -> bool: ...
    def list_staging(self, tenant_id: str, source_system: str | None = None) -> list[StagingRow]: ...
    def integration_status(self, tenant_id: str) -> list[dict[str, Any]]: ...


# ---------------------------------------------------------------------------
# Bellek içi depo
# ---------------------------------------------------------------------------


class InMemoryRepo:
    """Sözlük tabanlı depo. Tüm tenant-kapsamlı aramalar `(tenant_id, id)` ile yapılır."""

    def __init__(self) -> None:
        self.organizations: dict[str, Organization] = {}
        self.users: dict[str, User] = {}
        self.memberships: dict[tuple[str, str], set[str]] = {}
        self.revoked: dict[str, RevokedToken] = {}
        self.sessions_seen: set[tuple[str, str]] = set()
        self.periods: dict[tuple[str, str], Period] = {}
        self.period_reopens: list[PeriodReopen] = []
        self.records: dict[tuple[str, str], Record] = {}
        self.runs: dict[tuple[str, str], CalculationRun] = {}
        self.approvals: list[Approval] = []
        self.evidence: dict[tuple[str, str], Evidence] = {}
        self.reports: dict[tuple[str, str], ReportSnapshot] = {}
        self.audit: list[AuditEvent] = []
        self.idempotency: dict[tuple[str, str, str, str], IdempotencyEntry] = {}
        self.import_jobs: dict[tuple[str, str], ImportJob] = {}
        self.factors: dict[tuple[str, str], dict[str, Any]] = {}
        self.methods: dict[tuple[str, str], dict[str, Any]] = {}
        self.sources: dict[str, ReferenceSource] = {}
        self.source_versions: dict[str, list[ReferenceSourceVersion]] = {}
        self.staging: dict[tuple[str, str, str, str], StagingRow] = {}
        self._audit_seq = itertools.count(1)

    # kurum / kullanıcı / üyelik
    def add_organization(self, org: Organization) -> None:
        self.organizations[org.id] = org

    def get_organization(self, tenant_id: str) -> Organization | None:
        return self.organizations.get(tenant_id)

    def add_user(self, user: User) -> None:
        self.users[user.id] = user

    def get_user(self, user_id: str) -> User | None:
        return self.users.get(user_id)

    def get_user_by_subject(self, subject: str) -> User | None:
        return next((u for u in self.users.values() if u.oidc_subject == subject), None)

    def get_user_by_email(self, email: str) -> User | None:
        return next((u for u in self.users.values() if u.email.lower() == email.lower()), None)

    def get_membership_roles(self, tenant_id: str, user_id: str) -> frozenset[str]:
        return frozenset(self.memberships.get((tenant_id, user_id), set()))

    def list_memberships(self, tenant_id: str) -> list[dict[str, Any]]:
        return [{"user_id": u, "roles": sorted(r)} for (t, u), r in self.memberships.items() if t == tenant_id and r]

    def add_membership(self, tenant_id: str, user_id: str, role: str, granted_by: str | None) -> None:
        self.memberships.setdefault((tenant_id, user_id), set()).add(role)

    def revoke_membership(self, tenant_id: str, user_id: str, role: str) -> bool:
        roles = self.memberships.get((tenant_id, user_id))
        if roles and role in roles:
            roles.discard(role)
            return True
        return False

    # oturum
    def is_token_revoked(self, jti: str) -> bool:
        return jti in self.revoked

    def revoke_token(self, token: RevokedToken) -> None:
        self.revoked[token.jti] = token

    def mark_session_seen(self, tenant_id: str, jti: str, user_id: str) -> bool:
        key = (tenant_id, jti)
        if key in self.sessions_seen:
            return False
        self.sessions_seen.add(key)
        return True

    # dönem
    def add_period(self, period: Period) -> None:
        self.periods[(period.tenant_id, period.id)] = period

    def get_period(self, tenant_id: str, period_id: str) -> Period | None:
        return self.periods.get((tenant_id, period_id))

    def list_periods(self, tenant_id: str) -> list[Period]:
        return [p for (t, _), p in self.periods.items() if t == tenant_id]

    def set_period_status(self, tenant_id: str, period_id: str, status: str, actor: str | None) -> Period:
        period = self.periods[(tenant_id, period_id)]
        period.status = status
        if status == "locked":
            period.locked_at = utcnow_iso()
            period.locked_by = actor
        else:
            period.locked_at = None
            period.locked_by = None
        return period

    def add_period_reopen(self, reopen: PeriodReopen) -> None:
        self.period_reopens.append(reopen)

    def list_period_reopens(self, tenant_id: str, period_id: str) -> list[PeriodReopen]:
        return [r for r in self.period_reopens if r.tenant_id == tenant_id and r.period_id == period_id]

    # kayıt
    def add_record(self, record: Record) -> None:
        self.records[(record.tenant_id, record.id)] = record

    def get_record(self, tenant_id: str, record_id: str) -> Record | None:
        rec = self.records.get((tenant_id, record_id))
        return None if rec is None or rec.withdrawn_at else rec

    def list_records(self, tenant_id: str, period_id: str | None = None) -> list[Record]:
        out = [r for (t, _), r in self.records.items() if t == tenant_id and not r.withdrawn_at]
        if period_id is not None:
            out = [r for r in out if r.period_id == period_id]
        return out

    def append_version(self, version: RecordVersion) -> None:
        record = self.records[(version.tenant_id, version.record_id)]
        if record.versions and version.version != record.versions[-1].version + 1:
            raise RuntimeError("Sürüm numarası ardışık olmalı")
        record.versions.append(version)

    def find_record_by_row_hash(self, tenant_id: str, row_hash: str) -> Record | None:
        for (t, _), r in self.records.items():
            if t == tenant_id and r.row_hash == row_hash and not r.withdrawn_at:
                return r
        return None

    def withdraw_record(self, tenant_id: str, record_id: str, by: str, reason: str) -> Record:
        record = self.records[(tenant_id, record_id)]
        record.withdrawn_at = utcnow_iso()
        record.withdrawn_by = by
        record.withdrawn_reason = reason
        return record

    # hesap
    def add_run(self, run: CalculationRun) -> None:
        self.runs[(run.tenant_id, run.id)] = run

    def get_run(self, tenant_id: str, run_id: str) -> CalculationRun | None:
        return self.runs.get((tenant_id, run_id))

    def list_runs(self, tenant_id: str, record_id: str) -> list[CalculationRun]:
        return [r for (t, _), r in self.runs.items() if t == tenant_id and r.record_id == record_id]

    # onay
    def add_approval(self, approval: Approval) -> None:
        self.approvals.append(approval)

    def list_approvals(self, tenant_id: str, record_id: str) -> list[Approval]:
        return [a for a in self.approvals if a.tenant_id == tenant_id and a.record_id == record_id]

    # kanıt
    def add_evidence(self, evidence: Evidence) -> None:
        self.evidence[(evidence.tenant_id, evidence.id)] = evidence

    def get_evidence(self, tenant_id: str, evidence_id: str) -> Evidence | None:
        return self.evidence.get((tenant_id, evidence_id))

    def find_evidence_by_hash(self, tenant_id: str, sha256: str) -> list[Evidence]:
        return [e for (t, _), e in self.evidence.items() if t == tenant_id and e.sha256 == sha256]

    def update_evidence_object(self, tenant_id: str, evidence_id: str, *, object_key: str | None,
                               content_type: str | None, scan_status: str) -> Evidence:
        e = self.evidence[(tenant_id, evidence_id)]
        e.object_key, e.content_type, e.scan_status = object_key, content_type, scan_status
        return e

    # rapor
    def add_report(self, report: ReportSnapshot) -> None:
        self.reports[(report.tenant_id, report.id)] = report

    def get_report(self, tenant_id: str, report_id: str) -> ReportSnapshot | None:
        return self.reports.get((tenant_id, report_id))

    def list_reports(self, tenant_id: str, period_id: str) -> list[ReportSnapshot]:
        return [r for (t, _), r in self.reports.items() if t == tenant_id and r.period_id == period_id]

    # audit
    def append_audit(self, event: AuditEvent) -> AuditEvent:
        event.id = next(self._audit_seq)
        self.audit.append(event)
        return event

    def list_audit(self, tenant_id: str, object_id: str | None = None, limit: int = 100) -> list[AuditEvent]:
        out = [e for e in self.audit if e.tenant_id == tenant_id]
        if object_id is not None:
            out = [e for e in out if e.object_id == object_id]
        return out[-limit:]

    # idempotency
    def get_idempotency(self, tenant_id: str, user_id: str, endpoint: str, key: str) -> IdempotencyEntry | None:
        return self.idempotency.get((tenant_id, user_id, endpoint, key))

    def put_idempotency(self, tenant_id: str, user_id: str, endpoint: str, key: str, entry: IdempotencyEntry) -> None:
        self.idempotency[(tenant_id, user_id, endpoint, key)] = entry

    # içe aktarma
    def add_import_job(self, job: ImportJob) -> None:
        self.import_jobs[(job.tenant_id, job.id)] = job

    def get_import_job(self, tenant_id: str, job_id: str) -> ImportJob | None:
        return self.import_jobs.get((tenant_id, job_id))

    def find_import_job_by_sha(self, tenant_id: str, file_sha256: str) -> ImportJob | None:
        jobs = [j for (t, _), j in self.import_jobs.items()
                if t == tenant_id and j.file_sha256 == file_sha256 and j.mode == "apply" and j.status == "done"]
        return sorted(jobs, key=lambda j: j.created_at)[-1] if jobs else None

    def update_import_job(self, job: ImportJob) -> None:
        self.import_jobs[(job.tenant_id, job.id)] = job

    # katalog
    def add_factor(self, factor: dict[str, Any]) -> None:
        f = dict(factor)
        f.setdefault("status", "active")
        self.factors[(f["id"], f["version"])] = f

    def get_factor(self, factor_id: str, version: str) -> dict[str, Any] | None:
        f = self.factors.get((factor_id, version))
        return dict(f) if f else None

    def list_factors(self, factor_id: str | None = None, status: str | None = None) -> list[dict[str, Any]]:
        out = [dict(f) for f in self.factors.values()]
        if factor_id is not None:
            out = [f for f in out if f["id"] == factor_id]
        if status is not None:
            out = [f for f in out if f.get("status") == status]
        return sorted(out, key=lambda f: (f["id"], f["version"]))

    def set_factor_status(self, factor_id: str, version: str, status: str, by: str | None) -> dict[str, Any]:
        f = self.factors[(factor_id, version)]
        f["status"] = status
        if status == "active":
            f["activated_by"], f["activated_at"] = by, utcnow_iso()
        elif status == "retired":
            f["retired_at"] = utcnow_iso()
        return dict(f)

    def add_method(self, method: dict[str, Any]) -> None:
        self.methods[(method["id"], method["version"])] = dict(method)

    def get_method(self, method_id: str, version: str) -> dict[str, Any] | None:
        m = self.methods.get((method_id, version))
        return dict(m) if m else None

    def list_methods(self) -> list[dict[str, Any]]:
        return [dict(m) for m in sorted(self.methods.values(), key=lambda m: (m["id"], m["version"]))]

    # kaynak kayıt defteri
    def add_source(self, source: ReferenceSource) -> None:
        self.sources[source.id] = source

    def get_source(self, source_id: str) -> ReferenceSource | None:
        return self.sources.get(source_id)

    def list_sources(self) -> list[ReferenceSource]:
        return sorted(self.sources.values(), key=lambda s: s.created_at)

    def add_source_version(self, version: ReferenceSourceVersion) -> None:
        versions = self.source_versions.setdefault(version.source_id, [])
        if versions and version.version != versions[-1].version + 1:
            raise RuntimeError("Kaynak sürüm numarası ardışık olmalı")
        versions.append(version)

    def list_source_versions(self, source_id: str) -> list[ReferenceSourceVersion]:
        return list(self.source_versions.get(source_id, []))

    def approve_source_version(self, source_id: str, version: int, by: str) -> ReferenceSourceVersion | None:
        for v in self.source_versions.get(source_id, []):
            if v.version == version:
                v.expert_approved, v.approved_by, v.approved_at = True, by, utcnow_iso()
                return v
        return None

    def touch_source_version_checked(self, source_id: str, version: int) -> ReferenceSourceVersion | None:
        for v in self.source_versions.get(source_id, []):
            if v.version == version:
                v.last_checked_at = utcnow_iso()
                return v
        return None

    # entegrasyon staging
    def add_staging_row(self, row: StagingRow) -> bool:
        key = (row.tenant_id, row.source_system, row.external_id, row.event_id)
        if key in self.staging:
            return False
        self.staging[key] = row
        return True

    def list_staging(self, tenant_id: str, source_system: str | None = None) -> list[StagingRow]:
        out = [r for (t, *_), r in self.staging.items() if t == tenant_id]
        if source_system is not None:
            out = [r for r in out if r.source_system == source_system]
        return sorted(out, key=lambda r: r.received_at)

    def integration_status(self, tenant_id: str) -> list[dict[str, Any]]:
        by_sys: dict[str, dict[str, Any]] = {}
        for r in self.list_staging(tenant_id):
            s = by_sys.setdefault(r.source_system, {"source_system": r.source_system, "last_received_at": None, "pending": 0, "rows": 0})
            s["rows"] += 1
            s["pending"] += r.status == "pending"
            s["last_received_at"] = max(s["last_received_at"] or "", r.received_at)
        return sorted(by_sys.values(), key=lambda s: s["source_system"])
