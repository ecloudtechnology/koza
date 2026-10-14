"""pytest kurulumu: fixture'lar helpers.py içinde tanımlıdır (env iki depoyla parametreli)."""

import sys
from pathlib import Path

# importlib içe aktarma modunda (kök pytest.ini) bu dizin otomatik sys.path'e girmez.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from helpers import env, postgres_repo  # noqa: E402,F401


def pytest_configure(config):
    config.addinivalue_line("markers", "allow_self_approval: Kurum A politikası allow_self_approval=true ile kurulur")
    config.addinivalue_line("markers", "app_kwargs(**kw): create_app'e ek parametreler (object_store, signer, scanner...)")
