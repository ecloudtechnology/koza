"""Kurumlar arası erişim testleri için kurulum. apps/api/tests ile aynı katalog, motor ve iki depo (memory/postgres)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from koza_api import testing as T

REPO_ROOT = Path(__file__).resolve().parents[2]
CATALOG = json.loads((REPO_ROOT / "tests" / "fixtures" / "test_catalog.json").read_text(encoding="utf-8"))
ENGINE_KIND = T.ensure_calc_engine()


@pytest.fixture(scope="session")
def postgres_repo():
    repo, note = T.prepare_postgres()
    if repo is None:
        pytest.skip(f"PostgreSQL yok: {note}")
    yield repo
    T.teardown_postgres(repo)


@pytest.fixture(params=["memory", "postgres"])
def env(request):
    repo = request.getfixturevalue("postgres_repo") if request.param == "postgres" else None
    app, repo = T.build_app(CATALOG, repo=repo)
    with TestClient(app) as client:
        yield client, repo
