"""PostgreSQL deposu (psycopg v3) — `db/migrations/0001_init.sql` + `0002_api_dilim1.sql` şeması.

Desen (kural 3):
    with repo.session(tenant_id) as s:          # istek başına bir bağlantı + bir işlem
        ...                                     # ilk sorgudan önce set_config('app.tenant_id', ..., true) = SET LOCAL
    # başarıda commit, istisnada rollback; bağlantı kapanır — havuzda ayar sızıntısı yoktur

RLS politikaları `app_current_tenant()` ile kurum dışını görünmez kılar; `tenant_id` ayarlanmamışsa (boş dize → NULL)
hiçbir satır dönmez. Uygulama rolü BYPASSRLS taşımaz ve DELETE/TRUNCATE yetkisi yoktur (`migrate.py grant`).

Append-only tablolara (activity_record_version, calculation_run/result, approval, report_snapshot, audit_event,
period_reopen) yalnız INSERT yazılır; tetikleyiciler UPDATE/DELETE'i zaten reddeder (kural 9).

`PostgresRepo` kök nesnesi protokolü de uygular: her çağrı kısa ömürlü bir oturum açar (betikler ve testler için).
İstek işleme `deps.get_session` üzerinden tek oturum kullanır. `records` / `runs` / `audit` özellikleri yalnız
test/işletim incelemesi içindir ve `inspect_dsn` (RLS'i aşan sahip rolü) ister; uygulama kodu kullanmaz.
"""

from __future__ import annotations

from contextlib import contextmanager
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Iterator

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .repo import (
    Approval,
    AuditEvent,
    CalculationRun,
    Evidence,
    IdempotencyEntry,
    ImportJob,
    Organization,
    Period,
    PeriodReopen,
    Record,
    RecordVersion,
    ReferenceSource,
    ReferenceSourceVersion,
    ReportSnapshot,
    RevokedToken,
    StagingRow,
    User,
)

# ---------------------------------------------------------------------------
# Dönüşümler
# ---------------------------------------------------------------------------


def _num(v: Any) -> str | None:
    """numeric(28,10) → ondalık dize (sondaki sıfırlar düşer: 100.0000000000 → "100"). Asla float."""
    if v is None:
        return None
    if isinstance(v, Decimal):
        return format(v.normalize(), "f")
    return str(v)


def _ts(v: Any) -> str | None:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    return str(v)


def _date(v: Any) -> str | None:
    if v is None:
        return None
    return v.isoformat() if isinstance(v, date) else str(v)


def _s(v: Any) -> str | None:
    return None if v is None else str(v)


# ---------------------------------------------------------------------------
# Oturum: tek bağlantı + tek işlem + SET LOCAL app.tenant_id
# ---------------------------------------------------------------------------


class PostgresSession:
    def __init__(self, conn: psycopg.Connection, tenant_id: str | None) -> None:
        self.conn = conn
        self.tenant_id = tenant_id
        # Oturum içi kimlik haritası: yönlendirici elindeki Record nesnesi, append_version sonrası güncel kalır
        # (InMemoryRepo ile aynı davranış).
        self._records: dict[tuple[str, str], Record] = {}

    def _q(self, sql: str, params: tuple | None = None):
        return self.conn.execute(sql, params)

    # ---- kurum / kullanıcı / üyelik --------------------------------------
    def add_organization(self, org: Organization) -> None:
        self._q(
            "INSERT INTO organization (id, name, country, policy) VALUES (%s::uuid, %s, %s, %s)",
            (org.id, org.name, org.country, Jsonb(org.policy)),
        )

    def get_organization(self, tenant_id: str) -> Organization | None:
        row = self._q("SELECT id, name, country, policy FROM organization WHERE id = %s::uuid", (tenant_id,)).fetchone()
        return Organization(id=str(row["id"]), name=row["name"], policy=row["policy"], country=row["country"]) if row else None

    def add_user(self, user: User) -> None:
        self._q(
            "INSERT INTO app_user (id, email, display_name, oidc_subject) VALUES (%s::uuid, %s, %s, %s) "
            "ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name, "
            "oidc_subject = COALESCE(EXCLUDED.oidc_subject, app_user.oidc_subject)",
            (user.id, user.email, user.display_name, user.oidc_subject),
        )

    @staticmethod
    def _user(row) -> User | None:
        if not row:
            return None
        return User(id=str(row["id"]), email=row["email"], display_name=row["display_name"],
                    oidc_subject=row["oidc_subject"], disabled_at=_ts(row["disabled_at"]))

    _USER_SQL = "SELECT id, email, display_name, oidc_subject, disabled_at FROM app_user WHERE "

    def get_user(self, user_id: str) -> User | None:
        return self._user(self._q(self._USER_SQL + "id = %s::uuid", (user_id,)).fetchone())

    def get_user_by_subject(self, subject: str) -> User | None:
        return self._user(self._q(self._USER_SQL + "oidc_subject = %s", (subject,)).fetchone())

    def get_user_by_email(self, email: str) -> User | None:
        return self._user(self._q(self._USER_SQL + "lower(email) = lower(%s)", (email,)).fetchone())

    def get_membership_roles(self, tenant_id: str, user_id: str) -> frozenset[str]:
        rows = self._q(
            "SELECT role FROM membership WHERE tenant_id = %s::uuid AND user_id = %s::uuid AND revoked_at IS NULL",
            (tenant_id, user_id),
        ).fetchall()
        return frozenset(str(r["role"]) for r in rows)

    def list_memberships(self, tenant_id: str) -> list[dict[str, Any]]:
        rows = self._q(
            "SELECT user_id, array_agg(role::text ORDER BY role) AS roles FROM membership "
            "WHERE tenant_id = %s::uuid AND revoked_at IS NULL GROUP BY user_id ORDER BY user_id",
            (tenant_id,),
        ).fetchall()
        return [{"user_id": str(r["user_id"]), "roles": list(r["roles"])} for r in rows]

    def add_membership(self, tenant_id: str, user_id: str, role: str, granted_by: str | None) -> None:
        self._q(
            "INSERT INTO membership (tenant_id, user_id, role, granted_by) VALUES (%s::uuid, %s::uuid, %s::member_role, %s::uuid) "
            "ON CONFLICT (tenant_id, user_id, role) DO UPDATE SET revoked_at = NULL, granted_by = EXCLUDED.granted_by",
            (tenant_id, user_id, role, granted_by),
        )

    def revoke_membership(self, tenant_id: str, user_id: str, role: str) -> bool:
        cur = self._q(
            "UPDATE membership SET revoked_at = clock_timestamp() WHERE tenant_id = %s::uuid AND user_id = %s::uuid "
            "AND role = %s::member_role AND revoked_at IS NULL",
            (tenant_id, user_id, role),
        )
        return cur.rowcount == 1

    # ---- oturum ------------------------------------------------------------
    def is_token_revoked(self, jti: str) -> bool:
        return self._q("SELECT 1 FROM session_revocation WHERE jti = %s", (jti,)).fetchone() is not None

    def revoke_token(self, token: RevokedToken) -> None:
        self._q(
            "INSERT INTO session_revocation (jti, user_id, reason, expires_at) VALUES (%s, %s::uuid, %s, %s::timestamptz) "
            "ON CONFLICT (jti) DO NOTHING",
            (token.jti, token.user_id, token.reason, token.expires_at),
        )

    def mark_session_seen(self, tenant_id: str, jti: str, user_id: str) -> bool:
        cur = self._q(
            "INSERT INTO session_seen (tenant_id, jti, user_id) VALUES (%s::uuid, %s, %s::uuid) ON CONFLICT DO NOTHING",
            (tenant_id, jti, user_id),
        )
        return cur.rowcount == 1

    # ---- dönem -------------------------------------------------------------
    @staticmethod
    def _period(row) -> Period:
        return Period(id=str(row["id"]), tenant_id=str(row["tenant_id"]), start_date=_date(row["start_date"]),
                      end_date=_date(row["end_date"]), status=str(row["status"]), locked_at=_ts(row["locked_at"]),
                      locked_by=_s(row["locked_by"]), created_at=_ts(row["created_at"]))

    _PERIOD_COLS = "id, tenant_id, start_date, end_date, status, locked_at, locked_by, created_at"

    def add_period(self, period: Period) -> None:
        row = self._q(
            "INSERT INTO reporting_period (id, tenant_id, start_date, end_date, status, created_at) "
            "VALUES (%s::uuid, %s::uuid, %s::date, %s::date, %s::period_status, clock_timestamp()) RETURNING created_at",
            (period.id, period.tenant_id, period.start_date, period.end_date, period.status),
        ).fetchone()
        period.created_at = _ts(row["created_at"])

    def get_period(self, tenant_id: str, period_id: str) -> Period | None:
        row = self._q(f"SELECT {self._PERIOD_COLS} FROM reporting_period WHERE tenant_id = %s::uuid AND id = %s::uuid",
                      (tenant_id, period_id)).fetchone()
        return self._period(row) if row else None

    def list_periods(self, tenant_id: str) -> list[Period]:
        rows = self._q(f"SELECT {self._PERIOD_COLS} FROM reporting_period WHERE tenant_id = %s::uuid ORDER BY start_date, created_at",
                       (tenant_id,)).fetchall()
        return [self._period(r) for r in rows]

    def set_period_status(self, tenant_id: str, period_id: str, status: str, actor: str | None) -> Period:
        if status == "locked":
            row = self._q(
                "UPDATE reporting_period SET status = 'locked', locked_at = clock_timestamp(), locked_by = %s::uuid "
                f"WHERE tenant_id = %s::uuid AND id = %s::uuid RETURNING {self._PERIOD_COLS}",
                (actor, tenant_id, period_id),
            ).fetchone()
        else:
            row = self._q(
                "UPDATE reporting_period SET status = %s::period_status, locked_at = NULL, locked_by = NULL "
                f"WHERE tenant_id = %s::uuid AND id = %s::uuid RETURNING {self._PERIOD_COLS}",
                (status, tenant_id, period_id),
            ).fetchone()
        if row is None:
            raise KeyError(period_id)
        return self._period(row)

    def add_period_reopen(self, reopen: PeriodReopen) -> None:
        row = self._q(
            "INSERT INTO period_reopen (id, tenant_id, period_id, reason, impact_note, requested_by, approved_by, created_at) "
            "VALUES (%s::uuid, %s::uuid, %s::uuid, %s, %s, %s::uuid, %s::uuid, clock_timestamp()) RETURNING created_at",
            (reopen.id, reopen.tenant_id, reopen.period_id, reopen.reason, reopen.impact_note, reopen.requested_by, reopen.approved_by),
        ).fetchone()
        reopen.created_at = _ts(row["created_at"])

    def list_period_reopens(self, tenant_id: str, period_id: str) -> list[PeriodReopen]:
        rows = self._q(
            "SELECT id, tenant_id, period_id, reason, impact_note, requested_by, approved_by, created_at FROM period_reopen "
            "WHERE tenant_id = %s::uuid AND period_id = %s::uuid ORDER BY created_at",
            (tenant_id, period_id),
        ).fetchall()
        return [PeriodReopen(id=str(r["id"]), tenant_id=str(r["tenant_id"]), period_id=str(r["period_id"]), reason=r["reason"],
                             impact_note=r["impact_note"], requested_by=str(r["requested_by"]), approved_by=str(r["approved_by"]),
                             created_at=_ts(r["created_at"])) for r in rows]

    # ---- kayıt -------------------------------------------------------------
    _RECORD_COLS = ("id, tenant_id, period_id, source_id, created_by, created_at, import_job_id, row_hash, "
                    "withdrawn_at, withdrawn_by, withdrawn_reason")
    _VERSION_COLS = ("tenant_id, record_id, version, data_version, state, source_type, fuel, quantity, quantity_state, "
                     "not_applicable_reason, unit, heating_value_basis, data_quality, activity_start, activity_end, note, "
                     "author_id, transition, change_reason, created_at")

    @staticmethod
    def _version(r) -> RecordVersion:
        return RecordVersion(
            tenant_id=str(r["tenant_id"]), record_id=str(r["record_id"]), version=r["version"], data_version=r["data_version"],
            state=str(r["state"]), source_type=r["source_type"], fuel=r["fuel"], quantity=_num(r["quantity"]),
            quantity_state=str(r["quantity_state"]), not_applicable_reason=r["not_applicable_reason"], unit=r["unit"],
            heating_value_basis=r["heating_value_basis"], data_quality=str(r["data_quality"]),
            activity_start=_date(r["activity_start"]), activity_end=_date(r["activity_end"]), note=r["note"],
            author_id=str(r["author_id"]), transition=r["transition"], change_reason=r["change_reason"],
            created_at=_ts(r["created_at"]),
        )

    def _record(self, r, versions: list[RecordVersion]) -> Record:
        rec = Record(
            id=str(r["id"]), tenant_id=str(r["tenant_id"]), period_id=str(r["period_id"]), source_id=_s(r["source_id"]),
            created_by=str(r["created_by"]), created_at=_ts(r["created_at"]), versions=versions,
            import_job_id=_s(r["import_job_id"]), row_hash=r["row_hash"], withdrawn_at=_ts(r["withdrawn_at"]),
            withdrawn_by=_s(r["withdrawn_by"]), withdrawn_reason=r["withdrawn_reason"],
        )
        key = (rec.tenant_id, rec.id)
        cached = self._records.get(key)
        if cached is not None and len(cached.versions) >= len(versions):
            cached.withdrawn_at, cached.withdrawn_by, cached.withdrawn_reason = rec.withdrawn_at, rec.withdrawn_by, rec.withdrawn_reason
            return cached
        self._records[key] = rec
        return rec

    def add_record(self, record: Record) -> None:
        row = self._q(
            "INSERT INTO activity_record (id, tenant_id, period_id, source_id, created_by, created_at, import_job_id, row_hash) "
            "VALUES (%s::uuid, %s::uuid, %s::uuid, %s::uuid, %s::uuid, clock_timestamp(), %s::uuid, %s) RETURNING created_at",
            (record.id, record.tenant_id, record.period_id, record.source_id, record.created_by, record.import_job_id, record.row_hash),
        ).fetchone()
        record.created_at = _ts(row["created_at"])
        self._records[(record.tenant_id, record.id)] = record

    def _versions_for(self, tenant_id: str, record_ids: list[str]) -> dict[str, list[RecordVersion]]:
        if not record_ids:
            return {}
        rows = self._q(
            f"SELECT {self._VERSION_COLS} FROM activity_record_version WHERE tenant_id = %s::uuid "
            "AND record_id = ANY(%s::uuid[]) ORDER BY record_id, version",
            (tenant_id, record_ids),
        ).fetchall()
        out: dict[str, list[RecordVersion]] = {}
        for r in rows:
            out.setdefault(str(r["record_id"]), []).append(self._version(r))
        return out

    def get_record(self, tenant_id: str, record_id: str) -> Record | None:
        row = self._q(
            f"SELECT {self._RECORD_COLS} FROM activity_record WHERE tenant_id = %s::uuid AND id = %s::uuid AND withdrawn_at IS NULL",
            (tenant_id, record_id),
        ).fetchone()
        if row is None:
            return None
        return self._record(row, self._versions_for(tenant_id, [record_id]).get(record_id, []))

    def list_records(self, tenant_id: str, period_id: str | None = None) -> list[Record]:
        sql = f"SELECT {self._RECORD_COLS} FROM activity_record WHERE tenant_id = %s::uuid AND withdrawn_at IS NULL"
        params: tuple = (tenant_id,)
        if period_id is not None:
            sql += " AND period_id = %s::uuid"
            params += (period_id,)
        rows = self._q(sql + " ORDER BY created_at, id", params).fetchall()
        versions = self._versions_for(tenant_id, [str(r["id"]) for r in rows])
        return [self._record(r, versions.get(str(r["id"]), [])) for r in rows]

    def append_version(self, v: RecordVersion) -> None:
        last = self._q(
            "SELECT max(version) AS v FROM activity_record_version WHERE tenant_id = %s::uuid AND record_id = %s::uuid",
            (v.tenant_id, v.record_id),
        ).fetchone()["v"]
        if last is not None and v.version != last + 1:
            raise RuntimeError("Sürüm numarası ardışık olmalı")
        row = self._q(
            f"INSERT INTO activity_record_version ({self._VERSION_COLS}) VALUES "
            "(%s::uuid, %s::uuid, %s, %s, %s::record_state, %s, %s, %s::numeric, %s::value_state, %s, %s, %s, %s::data_quality, "
            "%s::date, %s::date, %s, %s::uuid, %s, %s, clock_timestamp()) RETURNING created_at",
            (v.tenant_id, v.record_id, v.version, v.data_version, v.state, v.source_type, v.fuel, v.quantity, v.quantity_state,
             v.not_applicable_reason, v.unit, v.heating_value_basis, v.data_quality, v.activity_start, v.activity_end, v.note,
             v.author_id, v.transition, v.change_reason),
        ).fetchone()
        v.created_at = _ts(row["created_at"])
        cached = self._records.get((v.tenant_id, v.record_id))
        if cached is not None and (not cached.versions or cached.versions[-1].version < v.version):
            cached.versions.append(v)

    def find_record_by_row_hash(self, tenant_id: str, row_hash: str) -> Record | None:
        row = self._q(
            f"SELECT {self._RECORD_COLS} FROM activity_record WHERE tenant_id = %s::uuid AND row_hash = %s "
            "AND withdrawn_at IS NULL ORDER BY created_at LIMIT 1",
            (tenant_id, row_hash),
        ).fetchone()
        if row is None:
            return None
        rid = str(row["id"])
        return self._record(row, self._versions_for(tenant_id, [rid]).get(rid, []))

    def withdraw_record(self, tenant_id: str, record_id: str, by: str, reason: str) -> Record:
        row = self._q(
            "UPDATE activity_record SET withdrawn_at = clock_timestamp(), withdrawn_by = %s::uuid, withdrawn_reason = %s "
            f"WHERE tenant_id = %s::uuid AND id = %s::uuid AND withdrawn_at IS NULL RETURNING {self._RECORD_COLS}",
            (by, reason, tenant_id, record_id),
        ).fetchone()
        if row is None:
            raise KeyError(record_id)
        return self._record(row, self._versions_for(tenant_id, [record_id]).get(record_id, []))

    # ---- hesap -------------------------------------------------------------
    _RUN_SQL = ("SELECT r.id, r.tenant_id, r.record_id, r.record_version, r.data_version, r.method_id, r.method_version, "
                "r.engine_version, r.factor_refs, r.request, r.inputs_hash, r.status, r.run_by, r.created_at, c.raw "
                "FROM calculation_run r JOIN calculation_result c ON c.tenant_id = r.tenant_id AND c.run_id = r.id ")

    @staticmethod
    def _run(r) -> CalculationRun:
        return CalculationRun(
            id=str(r["id"]), tenant_id=str(r["tenant_id"]), record_id=str(r["record_id"]), record_version=r["record_version"],
            data_version=r["data_version"], method_id=r["method_id"], method_version=r["method_version"],
            engine_version=r["engine_version"], factor_refs=r["factor_refs"], request=r["request"], inputs_hash=r["inputs_hash"],
            status=str(r["status"]), result=r["raw"], run_by=str(r["run_by"]), created_at=_ts(r["created_at"]),
        )

    def add_run(self, run: CalculationRun) -> None:
        row = self._q(
            "INSERT INTO calculation_run (id, tenant_id, record_id, record_version, data_version, method_id, method_version, "
            "engine_version, factor_refs, request, inputs_hash, status, run_by, created_at) VALUES "
            "(%s::uuid, %s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s::calc_status, %s::uuid, clock_timestamp()) "
            "RETURNING created_at",
            (run.id, run.tenant_id, run.record_id, run.record_version, run.data_version, run.method_id, run.method_version,
             run.engine_version, Jsonb(run.factor_refs), Jsonb(run.request), run.inputs_hash, run.status, run.run_by),
        ).fetchone()
        run.created_at = _ts(row["created_at"])
        res = run.result
        self._q(
            "INSERT INTO calculation_result (tenant_id, run_id, total_co2e_kg, coverage, boundary, claim_tr, components, "
            "warnings, blocks, trace, raw) VALUES (%s::uuid, %s::uuid, %s::numeric, %s, %s, %s, %s, %s, %s, %s, %s)",
            (run.tenant_id, run.id, res.get("total_co2e_kg"), res.get("coverage"), res.get("boundary"), res.get("claim_tr"),
             Jsonb(res.get("components") or []), Jsonb(res.get("warnings") or []), Jsonb(res.get("blocks") or []),
             Jsonb(res.get("trace") or []), Jsonb(res)),
        )

    def get_run(self, tenant_id: str, run_id: str) -> CalculationRun | None:
        row = self._q(self._RUN_SQL + "WHERE r.tenant_id = %s::uuid AND r.id = %s::uuid", (tenant_id, run_id)).fetchone()
        return self._run(row) if row else None

    def list_runs(self, tenant_id: str, record_id: str) -> list[CalculationRun]:
        rows = self._q(self._RUN_SQL + "WHERE r.tenant_id = %s::uuid AND r.record_id = %s::uuid ORDER BY r.created_at",
                       (tenant_id, record_id)).fetchall()
        return [self._run(r) for r in rows]

    # ---- onay --------------------------------------------------------------
    def add_approval(self, a: Approval) -> None:
        row = self._q(
            "INSERT INTO approval (id, tenant_id, record_id, record_version, run_id, decision, decided_by, comment, self_approval, "
            "self_approval_reason, created_at) VALUES (%s::uuid, %s::uuid, %s::uuid, %s, %s::uuid, %s::approval_decision, %s::uuid, "
            "%s, %s, %s, clock_timestamp()) RETURNING created_at",
            (a.id, a.tenant_id, a.record_id, a.record_version, a.run_id, a.decision, a.decided_by, a.comment, a.self_approval,
             a.self_approval_reason),
        ).fetchone()
        a.created_at = _ts(row["created_at"])

    def list_approvals(self, tenant_id: str, record_id: str) -> list[Approval]:
        rows = self._q(
            "SELECT id, tenant_id, record_id, record_version, run_id, decision, decided_by, comment, self_approval, "
            "self_approval_reason, created_at FROM approval WHERE tenant_id = %s::uuid AND record_id = %s::uuid ORDER BY created_at",
            (tenant_id, record_id),
        ).fetchall()
        return [Approval(id=str(r["id"]), tenant_id=str(r["tenant_id"]), record_id=str(r["record_id"]),
                         record_version=r["record_version"], run_id=_s(r["run_id"]), decision=str(r["decision"]),
                         decided_by=str(r["decided_by"]), comment=r["comment"], self_approval=r["self_approval"],
                         self_approval_reason=r["self_approval_reason"], created_at=_ts(r["created_at"])) for r in rows]

    # ---- kanıt -------------------------------------------------------------
    _EV_COLS = "id, tenant_id, sha256, filename, size_bytes, record_id, uploaded_by, scan_status, object_key, content_type, created_at"

    @staticmethod
    def _evidence(r) -> Evidence:
        return Evidence(id=str(r["id"]), tenant_id=str(r["tenant_id"]), sha256=r["sha256"], filename=r["filename"],
                        size_bytes=r["size_bytes"], record_id=_s(r["record_id"]), uploaded_by=str(r["uploaded_by"]),
                        scan_status=r["scan_status"], object_key=r["object_key"], content_type=r["content_type"],
                        created_at=_ts(r["created_at"]))

    def add_evidence(self, e: Evidence) -> None:
        row = self._q(
            "INSERT INTO evidence (id, tenant_id, sha256, filename, size_bytes, record_id, uploaded_by, scan_status, object_key, "
            "content_type, created_at) VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s::uuid, %s::uuid, %s, %s, %s, clock_timestamp()) "
            "RETURNING created_at",
            (e.id, e.tenant_id, e.sha256, e.filename, e.size_bytes, e.record_id, e.uploaded_by, e.scan_status, e.object_key, e.content_type),
        ).fetchone()
        e.created_at = _ts(row["created_at"])

    def get_evidence(self, tenant_id: str, evidence_id: str) -> Evidence | None:
        row = self._q(f"SELECT {self._EV_COLS} FROM evidence WHERE tenant_id = %s::uuid AND id = %s::uuid", (tenant_id, evidence_id)).fetchone()
        return self._evidence(row) if row else None

    def find_evidence_by_hash(self, tenant_id: str, sha256: str) -> list[Evidence]:
        rows = self._q(f"SELECT {self._EV_COLS} FROM evidence WHERE tenant_id = %s::uuid AND sha256 = %s ORDER BY created_at",
                       (tenant_id, sha256)).fetchall()
        return [self._evidence(r) for r in rows]

    def update_evidence_object(self, tenant_id: str, evidence_id: str, *, object_key: str | None,
                               content_type: str | None, scan_status: str) -> Evidence:
        row = self._q(
            "UPDATE evidence SET object_key = %s, content_type = %s, scan_status = %s WHERE tenant_id = %s::uuid AND id = %s::uuid "
            f"RETURNING {self._EV_COLS}",
            (object_key, content_type, scan_status, tenant_id, evidence_id),
        ).fetchone()
        if row is None:
            raise KeyError(evidence_id)
        return self._evidence(row)

    # ---- rapor -------------------------------------------------------------
    _REP_COLS = "id, tenant_id, period_id, version, manifest, manifest_sha256, supersedes_id, supersede_reason, created_by, created_at"

    @staticmethod
    def _report(r) -> ReportSnapshot:
        return ReportSnapshot(id=str(r["id"]), tenant_id=str(r["tenant_id"]), period_id=str(r["period_id"]), version=r["version"],
                              manifest=r["manifest"], manifest_sha256=r["manifest_sha256"], supersedes_id=_s(r["supersedes_id"]),
                              supersede_reason=r["supersede_reason"], created_by=str(r["created_by"]), created_at=_ts(r["created_at"]))

    def add_report(self, rep: ReportSnapshot) -> None:
        row = self._q(
            "INSERT INTO report_snapshot (id, tenant_id, period_id, version, manifest, manifest_sha256, supersedes_id, "
            "supersede_reason, created_by, created_at) VALUES (%s::uuid, %s::uuid, %s::uuid, %s, %s, %s, %s::uuid, %s, %s::uuid, "
            "clock_timestamp()) RETURNING created_at",
            (rep.id, rep.tenant_id, rep.period_id, rep.version, Jsonb(rep.manifest), rep.manifest_sha256, rep.supersedes_id,
             rep.supersede_reason, rep.created_by),
        ).fetchone()
        rep.created_at = _ts(row["created_at"])

    def get_report(self, tenant_id: str, report_id: str) -> ReportSnapshot | None:
        row = self._q(f"SELECT {self._REP_COLS} FROM report_snapshot WHERE tenant_id = %s::uuid AND id = %s::uuid",
                      (tenant_id, report_id)).fetchone()
        return self._report(row) if row else None

    def list_reports(self, tenant_id: str, period_id: str) -> list[ReportSnapshot]:
        rows = self._q(f"SELECT {self._REP_COLS} FROM report_snapshot WHERE tenant_id = %s::uuid AND period_id = %s::uuid ORDER BY version",
                       (tenant_id, period_id)).fetchall()
        return [self._report(r) for r in rows]

    # ---- audit -------------------------------------------------------------
    _AUDIT_COLS = "id, tenant_id, actor_id, action, object_type, object_id, object_version, reason, request_id, payload, occurred_at"

    @staticmethod
    def _audit(r) -> AuditEvent:
        return AuditEvent(id=r["id"], tenant_id=str(r["tenant_id"]), actor_id=_s(r["actor_id"]), action=r["action"],
                          object_type=r["object_type"], object_id=r["object_id"], object_version=r["object_version"],
                          reason=r["reason"], request_id=r["request_id"], payload=r["payload"], occurred_at=_ts(r["occurred_at"]))

    def append_audit(self, e: AuditEvent) -> AuditEvent:
        row = self._q(
            "INSERT INTO audit_event (tenant_id, actor_id, action, object_type, object_id, object_version, reason, request_id, "
            "payload, occurred_at) VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s, %s, clock_timestamp()) RETURNING id, occurred_at",
            (e.tenant_id, e.actor_id, e.action, e.object_type, e.object_id, e.object_version, e.reason, e.request_id, Jsonb(e.payload)),
        ).fetchone()
        e.id, e.occurred_at = row["id"], _ts(row["occurred_at"])
        return e

    def list_audit(self, tenant_id: str, object_id: str | None = None, limit: int = 100) -> list[AuditEvent]:
        sql = f"SELECT {self._AUDIT_COLS} FROM audit_event WHERE tenant_id = %s::uuid"
        params: tuple = (tenant_id,)
        if object_id is not None:
            sql += " AND object_id = %s"
            params += (object_id,)
        rows = self._q(sql + " ORDER BY id DESC LIMIT %s", params + (limit,)).fetchall()
        return [self._audit(r) for r in reversed(rows)]

    # ---- idempotency ---------------------------------------------------------
    def get_idempotency(self, tenant_id: str, user_id: str, endpoint: str, key: str) -> IdempotencyEntry | None:
        row = self._q(
            "SELECT request_hash, status_code, response FROM idempotency_key WHERE tenant_id = %s::uuid AND user_id = %s::uuid "
            "AND endpoint = %s AND key = %s",
            (tenant_id, user_id, endpoint, key),
        ).fetchone()
        return IdempotencyEntry(row["request_hash"], row["status_code"], row["response"]) if row else None

    def put_idempotency(self, tenant_id: str, user_id: str, endpoint: str, key: str, entry: IdempotencyEntry) -> None:
        self._q(
            "INSERT INTO idempotency_key (tenant_id, user_id, endpoint, key, request_hash, status_code, response) "
            "VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s, %s) ON CONFLICT DO NOTHING",
            (tenant_id, user_id, endpoint, key, entry.request_hash, entry.status_code, Jsonb(entry.response)),
        )

    # ---- içe aktarma -----------------------------------------------------------
    _JOB_COLS = "id, tenant_id, period_id, filename, file_sha256, mode, status, summary, rows, created_by, created_at, rolled_back_at, rolled_back_by"

    @staticmethod
    def _job(r) -> ImportJob:
        return ImportJob(id=str(r["id"]), tenant_id=str(r["tenant_id"]), period_id=str(r["period_id"]), filename=r["filename"],
                         file_sha256=r["file_sha256"], mode=r["mode"], status=r["status"], summary=r["summary"], rows=r["rows"],
                         created_by=str(r["created_by"]), created_at=_ts(r["created_at"]), rolled_back_at=_ts(r["rolled_back_at"]),
                         rolled_back_by=_s(r["rolled_back_by"]))

    def add_import_job(self, j: ImportJob) -> None:
        row = self._q(
            "INSERT INTO import_job (id, tenant_id, period_id, filename, file_sha256, mode, status, summary, rows, created_by, created_at) "
            "VALUES (%s::uuid, %s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s, %s::uuid, clock_timestamp()) RETURNING created_at",
            (j.id, j.tenant_id, j.period_id, j.filename, j.file_sha256, j.mode, j.status, Jsonb(j.summary), Jsonb(j.rows), j.created_by),
        ).fetchone()
        j.created_at = _ts(row["created_at"])

    def get_import_job(self, tenant_id: str, job_id: str) -> ImportJob | None:
        row = self._q(f"SELECT {self._JOB_COLS} FROM import_job WHERE tenant_id = %s::uuid AND id = %s::uuid", (tenant_id, job_id)).fetchone()
        return self._job(row) if row else None

    def find_import_job_by_sha(self, tenant_id: str, file_sha256: str) -> ImportJob | None:
        row = self._q(
            f"SELECT {self._JOB_COLS} FROM import_job WHERE tenant_id = %s::uuid AND file_sha256 = %s AND mode = 'apply' "
            "AND status = 'done' ORDER BY created_at DESC LIMIT 1",
            (tenant_id, file_sha256),
        ).fetchone()
        return self._job(row) if row else None

    def update_import_job(self, j: ImportJob) -> None:
        self._q(
            "UPDATE import_job SET status = %s, summary = %s, rows = %s, rolled_back_at = %s::timestamptz, rolled_back_by = %s::uuid "
            "WHERE tenant_id = %s::uuid AND id = %s::uuid",
            (j.status, Jsonb(j.summary), Jsonb(j.rows), j.rolled_back_at, j.rolled_back_by, j.tenant_id, j.id),
        )

    # ---- katalog -----------------------------------------------------------------
    _FACTOR_COLS = ("factor_id, version, value, numerator_unit, gas, denominator_unit, basis, reference_conditions, boundary, gwp_set_id, "
                    "country, year, source_ref, license, valid_from, valid_to, status, activated_by, activated_at, retired_at, created_by, created_at")

    @staticmethod
    def _factor(r) -> dict[str, Any]:
        return {
            "id": r["factor_id"], "version": r["version"], "value": _num(r["value"]), "numerator_unit": r["numerator_unit"],
            "gas": r["gas"], "denominator_unit": r["denominator_unit"], "basis": r["basis"],
            "reference_conditions": r["reference_conditions"], "boundary": r["boundary"], "gwp_set_id": r["gwp_set_id"],
            "country": r["country"], "year": r["year"], "source_ref": r["source_ref"], "license": r["license"],
            "valid_from": _date(r["valid_from"]), "valid_to": _date(r["valid_to"]), "status": r["status"],
            "activated_by": _s(r["activated_by"]), "activated_at": _ts(r["activated_at"]), "retired_at": _ts(r["retired_at"]),
            "created_by": _s(r["created_by"]), "created_at": _ts(r["created_at"]),
        }

    def add_factor(self, f: dict[str, Any]) -> None:
        self._q(
            "INSERT INTO factor_version (factor_id, version, value, numerator_unit, gas, denominator_unit, basis, reference_conditions, "
            "boundary, gwp_set_id, country, year, source_ref, license, valid_from, valid_to, status, created_by) VALUES "
            "(%s, %s, %s::numeric, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::date, %s::date, %s, %s::uuid)",
            (f["id"], f["version"], f["value"], f["numerator_unit"], f["gas"], f["denominator_unit"], f.get("basis"),
             Jsonb(f["reference_conditions"]) if f.get("reference_conditions") is not None else None, f["boundary"],
             f.get("gwp_set_id"), f.get("country"), f.get("year"), f["source_ref"], f.get("license", "unspecified"),
             f.get("valid_from"), f.get("valid_to"), f.get("status", "active"), f.get("created_by")),
        )

    def get_factor(self, factor_id: str, version: str) -> dict[str, Any] | None:
        row = self._q(f"SELECT {self._FACTOR_COLS} FROM factor_version WHERE factor_id = %s AND version = %s", (factor_id, version)).fetchone()
        return self._factor(row) if row else None

    def list_factors(self, factor_id: str | None = None, status: str | None = None) -> list[dict[str, Any]]:
        sql, params = f"SELECT {self._FACTOR_COLS} FROM factor_version WHERE true", ()
        if factor_id is not None:
            sql, params = sql + " AND factor_id = %s", params + (factor_id,)
        if status is not None:
            sql, params = sql + " AND status = %s", params + (status,)
        return [self._factor(r) for r in self._q(sql + " ORDER BY factor_id, version", params).fetchall()]

    def set_factor_status(self, factor_id: str, version: str, status: str, by: str | None) -> dict[str, Any]:
        if status == "active":
            sql = "UPDATE factor_version SET status = 'active', activated_by = %s::uuid, activated_at = clock_timestamp()"
            params: tuple = (by,)
        elif status == "retired":
            sql, params = "UPDATE factor_version SET status = 'retired', retired_at = clock_timestamp()", ()
        else:
            sql, params = "UPDATE factor_version SET status = %s", (status,)
        row = self._q(sql + f" WHERE factor_id = %s AND version = %s RETURNING {self._FACTOR_COLS}", params + (factor_id, version)).fetchone()
        if row is None:
            raise KeyError((factor_id, version))
        return self._factor(row)

    @staticmethod
    def _method(r) -> dict[str, Any]:
        return {"id": r["method_id"], "version": r["version"], "gwp_set": r["gwp_set"], "formula_ref": r["formula_ref"],
                "boundary": r["boundary"]}

    def add_method(self, m: dict[str, Any]) -> None:
        self._q(
            "INSERT INTO method_version (method_id, version, formula_ref, gwp_set, boundary, eligible_inputs, test_suite_ref) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s) ON CONFLICT DO NOTHING",
            (m["id"], m["version"], m.get("formula_ref", m["id"]), Jsonb(m.get("gwp_set") or {}), m.get("boundary", "unspecified"),
             Jsonb(m.get("eligible_inputs") or []), m.get("test_suite_ref")),
        )

    def get_method(self, method_id: str, version: str) -> dict[str, Any] | None:
        row = self._q("SELECT method_id, version, formula_ref, gwp_set, boundary FROM method_version WHERE method_id = %s AND version = %s",
                      (method_id, version)).fetchone()
        return self._method(row) if row else None

    def list_methods(self) -> list[dict[str, Any]]:
        rows = self._q("SELECT method_id, version, formula_ref, gwp_set, boundary FROM method_version ORDER BY method_id, version").fetchall()
        return [self._method(r) for r in rows]

    # ---- kaynak kayıt defteri --------------------------------------------------------
    @staticmethod
    def _source(r) -> ReferenceSource:
        return ReferenceSource(id=str(r["id"]), name=r["name"], publisher=r["publisher"], url=r["url"], kind=r["kind"],
                               license=r["license"], created_by=str(r["created_by"]), created_at=_ts(r["created_at"]))

    def add_source(self, s: ReferenceSource) -> None:
        row = self._q(
            "INSERT INTO reference_source (id, name, publisher, url, kind, license, created_by, created_at) "
            "VALUES (%s::uuid, %s, %s, %s, %s, %s, %s::uuid, clock_timestamp()) RETURNING created_at",
            (s.id, s.name, s.publisher, s.url, s.kind, s.license, s.created_by),
        ).fetchone()
        s.created_at = _ts(row["created_at"])

    def get_source(self, source_id: str) -> ReferenceSource | None:
        row = self._q("SELECT id, name, publisher, url, kind, license, created_by, created_at FROM reference_source WHERE id = %s::uuid",
                      (source_id,)).fetchone()
        return self._source(row) if row else None

    def list_sources(self) -> list[ReferenceSource]:
        rows = self._q("SELECT id, name, publisher, url, kind, license, created_by, created_at FROM reference_source ORDER BY created_at").fetchall()
        return [self._source(r) for r in rows]

    _SV_COLS = ("source_id, version, publication_date, effective_date, covered_period_start, covered_period_end, early_adoption_note, "
                "seen_at, last_checked_at, content_hash, content_url, change_card, expert_approved, approved_by, approved_at, created_by, created_at")

    @staticmethod
    def _source_version(r) -> ReferenceSourceVersion:
        return ReferenceSourceVersion(
            source_id=str(r["source_id"]), version=r["version"], publication_date=_date(r["publication_date"]),
            effective_date=_date(r["effective_date"]), covered_period_start=_date(r["covered_period_start"]),
            covered_period_end=_date(r["covered_period_end"]), early_adoption_note=r["early_adoption_note"], seen_at=_ts(r["seen_at"]),
            last_checked_at=_ts(r["last_checked_at"]), content_hash=r["content_hash"], content_url=r["content_url"],
            change_card=r["change_card"], expert_approved=r["expert_approved"], approved_by=_s(r["approved_by"]),
            approved_at=_ts(r["approved_at"]), created_by=str(r["created_by"]), created_at=_ts(r["created_at"]),
        )

    def add_source_version(self, v: ReferenceSourceVersion) -> None:
        last = self._q("SELECT max(version) AS v FROM reference_source_version WHERE source_id = %s::uuid", (v.source_id,)).fetchone()["v"]
        if last is not None and v.version != last + 1:
            raise RuntimeError("Kaynak sürüm numarası ardışık olmalı")
        row = self._q(
            f"INSERT INTO reference_source_version ({self._SV_COLS}) VALUES (%s::uuid, %s, %s::date, %s::date, %s::date, %s::date, %s, "
            "%s::timestamptz, %s::timestamptz, %s, %s, %s, %s, %s::uuid, %s::timestamptz, %s::uuid, clock_timestamp()) RETURNING created_at",
            (v.source_id, v.version, v.publication_date, v.effective_date, v.covered_period_start, v.covered_period_end,
             v.early_adoption_note, v.seen_at, v.last_checked_at, v.content_hash, v.content_url, Jsonb(v.change_card),
             v.expert_approved, v.approved_by, v.approved_at, v.created_by),
        ).fetchone()
        v.created_at = _ts(row["created_at"])

    def list_source_versions(self, source_id: str) -> list[ReferenceSourceVersion]:
        rows = self._q(f"SELECT {self._SV_COLS} FROM reference_source_version WHERE source_id = %s::uuid ORDER BY version", (source_id,)).fetchall()
        return [self._source_version(r) for r in rows]

    def approve_source_version(self, source_id: str, version: int, by: str) -> ReferenceSourceVersion | None:
        row = self._q(
            "UPDATE reference_source_version SET expert_approved = true, approved_by = %s::uuid, approved_at = clock_timestamp() "
            f"WHERE source_id = %s::uuid AND version = %s RETURNING {self._SV_COLS}",
            (by, source_id, version),
        ).fetchone()
        return self._source_version(row) if row else None

    def touch_source_version_checked(self, source_id: str, version: int) -> ReferenceSourceVersion | None:
        row = self._q(
            "UPDATE reference_source_version SET last_checked_at = clock_timestamp() WHERE source_id = %s::uuid AND version = %s "
            f"RETURNING {self._SV_COLS}",
            (source_id, version),
        ).fetchone()
        return self._source_version(row) if row else None

    # ---- entegrasyon staging ----------------------------------------------------------
    _STG_COLS = "id, tenant_id, source_system, external_id, event_id, pulled_at, mapping_version, payload, status, request_id, received_at"

    @staticmethod
    def _staging(r) -> StagingRow:
        return StagingRow(id=str(r["id"]), tenant_id=str(r["tenant_id"]), source_system=r["source_system"], external_id=r["external_id"],
                          event_id=r["event_id"], pulled_at=_ts(r["pulled_at"]), mapping_version=r["mapping_version"], payload=r["payload"],
                          status=r["status"], request_id=r["request_id"], received_at=_ts(r["received_at"]))

    def add_staging_row(self, row: StagingRow) -> bool:
        cur = self._q(
            "INSERT INTO integration_staging (id, tenant_id, source_system, external_id, event_id, pulled_at, mapping_version, payload, "
            "status, request_id, received_at) VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s::timestamptz, %s, %s, %s, %s, clock_timestamp()) "
            "ON CONFLICT (tenant_id, source_system, external_id, event_id) DO NOTHING",
            (row.id, row.tenant_id, row.source_system, row.external_id, row.event_id, row.pulled_at, row.mapping_version,
             Jsonb(row.payload), row.status, row.request_id),
        )
        return cur.rowcount == 1

    def list_staging(self, tenant_id: str, source_system: str | None = None) -> list[StagingRow]:
        sql, params = f"SELECT {self._STG_COLS} FROM integration_staging WHERE tenant_id = %s::uuid", (tenant_id,)
        if source_system is not None:
            sql, params = sql + " AND source_system = %s", params + (source_system,)
        return [self._staging(r) for r in self._q(sql + " ORDER BY received_at, id", params).fetchall()]

    def integration_status(self, tenant_id: str) -> list[dict[str, Any]]:
        rows = self._q(
            "SELECT source_system, max(received_at) AS last_received_at, count(*) FILTER (WHERE status = 'pending') AS pending, "
            "count(*) AS rows FROM integration_staging WHERE tenant_id = %s::uuid GROUP BY source_system ORDER BY source_system",
            (tenant_id,),
        ).fetchall()
        return [{"source_system": r["source_system"], "last_received_at": _ts(r["last_received_at"]), "pending": r["pending"],
                 "rows": r["rows"]} for r in rows]


# ---------------------------------------------------------------------------
# Kök depo
# ---------------------------------------------------------------------------

PLATFORM_METHODS = frozenset({
    "add_user", "get_user", "get_user_by_subject", "get_user_by_email", "is_token_revoked", "revoke_token",
    "add_factor", "get_factor", "list_factors", "set_factor_status", "add_method", "get_method", "list_methods",
    "add_source", "get_source", "list_sources", "add_source_version", "list_source_versions", "approve_source_version",
    "touch_source_version_checked",
})

# Test/işletim incelemesinde temizlenecek tablolar (yalnız inspect_dsn ile; uygulama rolünde TRUNCATE yetkisi yoktur)
ALL_TABLES = (
    "audit_event", "idempotency_key", "report_snapshot", "approval", "calculation_result", "calculation_run",
    "activity_evidence", "evidence", "activity_detail", "activity_record_version", "activity_record", "import_job",
    "integration_staging", "session_seen", "session_revocation", "period_reopen", "reporting_period", "emission_source",
    "facility", "inventory_boundary", "membership", "reference_source_version", "reference_source", "factor_version",
    "method_version", "app_user", "organization",
)


class PostgresRepo:
    """PostgreSQL deposu. `session(tenant_id)` ile istek başına oturum; kök çağrılar kısa oturum açar."""

    kind = "postgres"

    def __init__(self, dsn: str, *, inspect_dsn: str | None = None) -> None:
        self.dsn = dsn
        self.inspect_dsn = inspect_dsn

    @contextmanager
    def session(self, tenant_id: str | None) -> Iterator[PostgresSession]:
        with psycopg.connect(self.dsn, row_factory=dict_row) as conn:
            # SET LOCAL eşdeğeri: işlem bitince sıfırlanır (is_local=true); havuzda sızmaz
            conn.execute("SELECT set_config('app.tenant_id', %s, true)", (tenant_id or "",))
            yield PostgresSession(conn, tenant_id)

    def __getattr__(self, name: str):
        if name.startswith("_") or not hasattr(PostgresSession, name):
            raise AttributeError(name)

        def call(*args, **kwargs):
            tenant: str | None = None
            if name == "add_organization":
                tenant = args[0].id
            elif name not in PLATFORM_METHODS:
                first = args[0] if args else next(iter(kwargs.values()), None)
                tenant = getattr(first, "tenant_id", None) or (first if isinstance(first, str) else None)
            with self.session(tenant) as s:
                return getattr(s, name)(*args, **kwargs)

        return call

    # ---- inceleme (test/işletim; RLS'i aşan sahip rolü gerekir) -------------
    def _inspect(self) -> psycopg.Connection:
        if not self.inspect_dsn:
            raise RuntimeError("inspect_dsn verilmedi; kurumlar arası inceleme yalnız test/işletim içindir.")
        return psycopg.connect(self.inspect_dsn, row_factory=dict_row, autocommit=True)

    def reset_for_tests(self) -> None:
        """Tüm tabloları boşaltır (yalnız test). Uygulama rolü bunu yapamaz; sahip rolü kullanılır."""
        with self._inspect() as conn:
            conn.execute("TRUNCATE " + ", ".join(ALL_TABLES) + " RESTART IDENTITY CASCADE")

    @property
    def records(self) -> dict[tuple[str, str], Record]:
        with self._inspect() as conn:
            s = PostgresSession(conn, None)
            rows = conn.execute(f"SELECT {PostgresSession._RECORD_COLS} FROM activity_record ORDER BY created_at").fetchall()
            out = {}
            for r in rows:
                tid, rid = str(r["tenant_id"]), str(r["id"])
                out[(tid, rid)] = s._record(r, s._versions_for(tid, [rid]).get(rid, []))
            return out

    @property
    def runs(self) -> dict[tuple[str, str], CalculationRun]:
        with self._inspect() as conn:
            rows = conn.execute(PostgresSession._RUN_SQL + "ORDER BY r.created_at").fetchall()
            return {(str(r["tenant_id"]), str(r["id"])): PostgresSession._run(r) for r in rows}

    @property
    def audit(self) -> list[AuditEvent]:
        with self._inspect() as conn:
            rows = conn.execute(f"SELECT {PostgresSession._AUDIT_COLS} FROM audit_event ORDER BY id").fetchall()
            return [PostgresSession._audit(r) for r in rows]
