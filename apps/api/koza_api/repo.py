"""Depo katmanı.

Her okuma/yazma `(tenant_id, id)` anahtarıyla yapılır; yabancı kurumun nesnesi `None` döner ve
yönlendirici 404 verir (403 değil — varlık açıklanmaz, §27). Bu, DB'deki RLS'nin uygulama
içi karşılığıdır; ikisi birlikte çalışır (kural 3).

Sürüm, koşum, onay, rapor ve audit satırları yalnız EKLENİR; depo arayüzünde update/delete yoktur.
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
    scan_status: str = "pending"
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


# ---------------------------------------------------------------------------
# Protokol
# ---------------------------------------------------------------------------


class Repository(Protocol):
    # kurum
    def get_organization(self, tenant_id: str) -> Organization | None: ...

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

    # hesap
    def add_run(self, run: CalculationRun) -> None: ...
    def get_run(self, tenant_id: str, run_id: str) -> CalculationRun | None: ...
    def list_runs(self, tenant_id: str, record_id: str) -> list[CalculationRun]: ...

    # onay
    def add_approval(self, approval: Approval) -> None: ...
    def list_approvals(self, tenant_id: str, record_id: str) -> list[Approval]: ...

    # kanıt
    def add_evidence(self, evidence: Evidence) -> None: ...
    def find_evidence_by_hash(self, tenant_id: str, sha256: str) -> list[Evidence]: ...

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

    # katalog (platform düzeyi; kural 12: test faktörleri yalnız testlerde yüklenir)
    def get_factor(self, factor_id: str, version: str) -> dict[str, Any] | None: ...
    def get_method(self, method_id: str, version: str) -> dict[str, Any] | None: ...


# ---------------------------------------------------------------------------
# Bellek içi depo
# ---------------------------------------------------------------------------


class InMemoryRepo:
    """Sözlük tabanlı depo. Tüm tenant-kapsamlı aramalar `(tenant_id, id)` ile yapılır."""

    def __init__(self) -> None:
        self.organizations: dict[str, Organization] = {}
        self.periods: dict[tuple[str, str], Period] = {}
        self.period_reopens: list[PeriodReopen] = []
        self.records: dict[tuple[str, str], Record] = {}
        self.runs: dict[tuple[str, str], CalculationRun] = {}
        self.approvals: list[Approval] = []
        self.evidence: dict[tuple[str, str], Evidence] = {}
        self.reports: dict[tuple[str, str], ReportSnapshot] = {}
        self.audit: list[AuditEvent] = []
        self.idempotency: dict[tuple[str, str, str, str], IdempotencyEntry] = {}
        self.factors: dict[tuple[str, str], dict[str, Any]] = {}
        self.methods: dict[tuple[str, str], dict[str, Any]] = {}
        self._audit_seq = itertools.count(1)

    # kurum
    def add_organization(self, org: Organization) -> None:
        self.organizations[org.id] = org

    def get_organization(self, tenant_id: str) -> Organization | None:
        return self.organizations.get(tenant_id)

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
        return self.records.get((tenant_id, record_id))

    def list_records(self, tenant_id: str, period_id: str | None = None) -> list[Record]:
        out = [r for (t, _), r in self.records.items() if t == tenant_id]
        if period_id is not None:
            out = [r for r in out if r.period_id == period_id]
        return out

    def append_version(self, version: RecordVersion) -> None:
        record = self.records[(version.tenant_id, version.record_id)]
        if record.versions and version.version != record.versions[-1].version + 1:
            raise RuntimeError("Sürüm numarası ardışık olmalı")
        record.versions.append(version)

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

    def find_evidence_by_hash(self, tenant_id: str, sha256: str) -> list[Evidence]:
        return [e for (t, _), e in self.evidence.items() if t == tenant_id and e.sha256 == sha256]

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

    # katalog
    def add_factor(self, factor: dict[str, Any]) -> None:
        self.factors[(factor["id"], factor["version"])] = dict(factor)

    def get_factor(self, factor_id: str, version: str) -> dict[str, Any] | None:
        f = self.factors.get((factor_id, version))
        return dict(f) if f else None

    def add_method(self, method: dict[str, Any]) -> None:
        self.methods[(method["id"], method["version"])] = dict(method)

    def get_method(self, method_id: str, version: str) -> dict[str, Any] | None:
        m = self.methods.get((method_id, version))
        return dict(m) if m else None


class PostgresRepo:
    """PostgreSQL deposu — HENÜZ UYGULANMADI.

    Şema: `db/migrations/0001_init.sql`. Uygulama deseni:

        async with pool.connection() as conn, conn.transaction():
            await conn.execute("SET LOCAL app.tenant_id = %s", (ctx.tenant_id,))
            ...  # tüm sorgular bu işlem içinde; RLS politikası tenant dışını görünmez kılar

    `SET LOCAL` işlem sonunda sıfırlanır; bağlantı havuzunda sızıntı olmaz. Sürüm/koşum/onay/rapor/
    audit tabloları append-only tetikleyicilidir; bu sınıfta UPDATE/DELETE yazılmaz.
    """

    def __init__(self, dsn: str) -> None:
        self.dsn = dsn

    def __getattr__(self, name: str):  # pragma: no cover - taslak
        raise NotImplementedError(
            "PostgresRepo henüz uygulanmadı; db/migrations/0001_init.sql ve SET LOCAL app.tenant_id desenine bakın."
        )
