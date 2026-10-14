"""RLS testleri (kural 3, yalnız PostgreSQL): B oturumu A'nın kimliğini bilse bile satır göremez; app.tenant_id
ayarlanmadan sıfır satır; uygulama rolü DELETE/TRUNCATE yapamaz; append-only tetikleyici UPDATE'i reddeder."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from koza_api import testing as T

CATALOG = json.loads((Path(__file__).resolve().parents[1] / "fixtures" / "test_catalog.json").read_text(encoding="utf-8"))

A, B = T.TENANT_A, T.TENANT_B
FACTOR = {"id": "TEST-NG-CO2", "version": "1.0"}
METHOD = {"id": "ghgp-corporate-test", "version": "0.1"}


@pytest.fixture
def pg(postgres_repo):
    app, repo = T.build_app(CATALOG, repo=postgres_repo)
    with TestClient(app) as client:
        yield client, repo


def _make_record(client):
    r = client.post("/v1/activities", json={"period_id": T.PERIOD_A, "source_type": "stationary_combustion", "fuel": "natural_gas",
                                             "quantity": "100", "quantity_state": "known", "unit": "GJ", "heating_value_basis": "LHV",
                                             "activity_start": "2026-01-01", "activity_end": "2026-01-31"},
                    headers=T.headers("tok-a-entry", A, **{"Idempotency-Key": "rls-1"}))
    assert r.status_code == 201, r.text
    rec = r.json()["data"]
    client.post(f"/v1/activities/{rec['id']}/calculate", json={"factor_refs": [FACTOR], "method": METHOD}, headers=T.headers("tok-a-entry", A))
    return rec


def test_forged_id_in_tenant_b_session_returns_zero_rows(pg):
    client, repo = pg
    rec = _make_record(client)
    with repo.session(B) as s:  # B'nin oturumu, A'nın gerçek kayıt kimliğiyle doğrudan SQL
        tables = {
            "activity_record": "SELECT count(*) AS n FROM activity_record WHERE id = %s::uuid",
            "activity_record_version": "SELECT count(*) AS n FROM activity_record_version WHERE record_id = %s::uuid",
            "calculation_run": "SELECT count(*) AS n FROM calculation_run WHERE record_id = %s::uuid",
            "audit_event": "SELECT count(*) AS n FROM audit_event WHERE object_id = %s",
        }
        for table, sql in tables.items():
            assert s.conn.execute(sql, (rec["id"],)).fetchone()["n"] == 0, table
        assert s.conn.execute("SELECT count(*) AS n FROM organization").fetchone()["n"] == 1  # yalnız B
        assert s.get_record(A, rec["id"]) is None
        # tenant_id'yi gövdeye/filtreye yazmak da işe yaramaz: WITH CHECK politikası yabancı tenant'a INSERT'i reddeder
        import psycopg

        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            s.conn.execute("SAVEPOINT x")
            s.conn.execute("INSERT INTO reporting_period (tenant_id, start_date, end_date) VALUES (%s::uuid, '2026-01-01', '2026-12-31')", (A,))
    with repo.session(A) as s:
        assert s.conn.execute("SELECT count(*) AS n FROM activity_record WHERE id = %s::uuid", (rec["id"],)).fetchone()["n"] == 1


def test_missing_tenant_setting_returns_zero_rows(pg):
    client, repo = pg
    rec = _make_record(client)
    with repo.session(None) as s:  # app.tenant_id = '' → NULL → politika hiçbir satır eşlemez
        for table in ("organization", "reporting_period", "activity_record", "activity_record_version", "calculation_run",
                      "audit_event", "idempotency_key", "membership"):
            assert s.conn.execute(f"SELECT count(*) AS n FROM {table}").fetchone()["n"] == 0, table
        assert s.get_record(A, rec["id"]) is None
        assert s.list_records(A) == []
    assert len(repo.records) >= 1  # sahip rolü (inspect) görür: veri yerinde


def test_app_role_cannot_delete_and_append_only_rejects_update(pg):
    client, repo = pg
    rec = _make_record(client)
    import psycopg

    with repo.session(A) as s:
        for sql in ("DELETE FROM activity_record_version WHERE record_id = %s::uuid",
                    "UPDATE activity_record_version SET quantity = 1 WHERE record_id = %s::uuid",
                    "DELETE FROM audit_event WHERE object_id = %s",
                    "UPDATE calculation_run SET status = 'blocked' WHERE record_id = %s::uuid",
                    "DELETE FROM activity_record WHERE id = %s::uuid"):
            s.conn.execute("SAVEPOINT sp")
            with pytest.raises((psycopg.errors.InsufficientPrivilege, psycopg.errors.IntegrityConstraintViolation)):
                s.conn.execute(sql, (rec["id"],))
            s.conn.execute("ROLLBACK TO SAVEPOINT sp")
        s.conn.execute("SAVEPOINT sp")
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            s.conn.execute("TRUNCATE activity_record_version")
        s.conn.execute("ROLLBACK TO SAVEPOINT sp")
        assert s.conn.execute("SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user").fetchone() == {"rolbypassrls": False, "rolsuper": False}


def test_set_local_does_not_leak_between_sessions(pg):
    client, repo = pg
    _make_record(client)
    with repo.session(A) as s:
        assert s.conn.execute("SELECT count(*) AS n FROM activity_record").fetchone()["n"] == 1
    with repo.session(B) as s:
        assert s.conn.execute("SELECT current_setting('app.tenant_id', true) AS t").fetchone()["t"] == B
        assert s.conn.execute("SELECT count(*) AS n FROM activity_record").fetchone()["n"] == 0
