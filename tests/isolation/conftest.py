"""Kurumlar arası erişim testleri için kurulum. apps/api/tests/conftest.py ile aynı katalog ve motor."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from koza_api import testing as T

REPO_ROOT = Path(__file__).resolve().parents[2]
CATALOG = json.loads((REPO_ROOT / "tests" / "fixtures" / "test_catalog.json").read_text(encoding="utf-8"))
ENGINE_KIND = T.ensure_calc_engine()


@pytest.fixture
def env():
    app, repo = T.build_app(CATALOG)
    with TestClient(app) as client:
        yield client, repo
