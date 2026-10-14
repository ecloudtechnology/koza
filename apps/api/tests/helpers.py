"""Ortak test yardımcıları. Gerçek `koza_calc` kuruluysa o kullanılır; değilse sözleşme biçimli taklit.

`env` fixture'ı iki depoyla parametrelidir: `memory` (InMemoryRepo) ve `postgres` (PostgresRepo; yerel PostgreSQL yoksa
skip). Kurum politikası `@pytest.mark.allow_self_approval` işaretiyle açılır.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from koza_api import testing as T

REPO_ROOT = Path(__file__).resolve().parents[3]
CATALOG = json.loads((REPO_ROOT / "tests" / "fixtures" / "test_catalog.json").read_text(encoding="utf-8"))
ENGINE_KIND = T.ensure_calc_engine()

FACTOR_V1 = {"id": "TEST-NG-CO2", "version": "1.0"}
FACTOR_V2 = {"id": "TEST-NG-CO2", "version": "2.0"}
METHOD = {"id": "ghgp-corporate-test", "version": "0.1"}


@pytest.fixture(scope="session")
def postgres_repo():
    repo, note = T.prepare_postgres()
    if repo is None:
        pytest.skip(f"PostgreSQL yok: {note}")
    yield repo
    T.teardown_postgres(repo)


@pytest.fixture(params=["memory", "postgres"])
def env(request):
    allow_self = request.node.get_closest_marker("allow_self_approval") is not None
    kw = {}
    extra = request.node.get_closest_marker("app_kwargs")
    if extra:
        kw.update(extra.kwargs)
    repo = request.getfixturevalue("postgres_repo") if request.param == "postgres" else None
    app, repo = T.build_app(CATALOG, repo=repo, allow_self_approval_a=allow_self, **kw)
    with TestClient(app) as client:
        yield client, repo


def H(token: str, tenant: str = T.TENANT_A, **extra: str) -> dict[str, str]:
    return T.headers(token, tenant, **extra)


def activity_body(**overrides):
    body = {
        "period_id": T.PERIOD_A,
        "source_type": "stationary_combustion",
        "fuel": "natural_gas",
        "quantity": "100",
        "quantity_state": "known",
        "unit": "GJ",
        "heating_value_basis": "LHV",
        "data_quality": "measured",
        "activity_start": "2026-01-01",
        "activity_end": "2026-01-31",
    }
    body.update(overrides)
    return body


def create(client, token="tok-a-entry", tenant=T.TENANT_A, key="k-1", **overrides):
    r = client.post("/v1/activities", json=activity_body(**overrides), headers=H(token, tenant, **{"Idempotency-Key": key}))
    assert r.status_code == 201, r.text
    return r.json()["data"]


def calculate(client, record_id, token="tok-a-entry", tenant=T.TENANT_A, factor=FACTOR_V1):
    r = client.post(f"/v1/activities/{record_id}/calculate", json={"factor_refs": [factor], "method": METHOD}, headers=H(token, tenant))
    assert r.status_code == 201, r.text
    return r.json()["data"]


def submit(client, record_id, token="tok-a-entry", tenant=T.TENANT_A):
    r = client.post(f"/v1/activities/{record_id}/submit", headers=H(token, tenant))
    assert r.status_code == 200, r.text
    return r.json()["data"]


def approve(client, record_id, version, token="tok-a-approver", tenant=T.TENANT_A, **extra):
    r = client.post("/v1/approvals", json={"record_id": record_id, "expected_version": version, "decision": "approve", **extra}, headers=H(token, tenant))
    assert r.status_code == 201, r.text
    return r.json()["data"]


def approved_record(client, key="k-approved", **overrides):
    """create → calculate → submit → approve; onaylı kaydı döner."""
    rec = create(client, key=key, **overrides)
    calculate(client, rec["id"])
    sub = submit(client, rec["id"])
    data = approve(client, rec["id"], sub["version"])
    return data["activity"]
