"""Test yardımcıları: sabit kurum/kullanıcı kimlikleri, token deposu, uygulama kurucu, motor taklidi.

Faktör DEĞERLERİ burada değildir; `tests/fixtures/test_catalog.json` altında yaşar (kural 12).
"""

from __future__ import annotations

import hashlib
import json
import sys
import types
from decimal import Decimal
from typing import Any

from .auth import DevTokenStore, Membership, Principal
from .main import create_app
from .repo import InMemoryRepo, Organization, Period

TENANT_A = "11111111-1111-4111-8111-111111111111"
TENANT_B = "22222222-2222-4222-8222-222222222222"
PERIOD_A = "aaaaaaa1-0000-4000-8000-000000000001"
PERIOD_B = "bbbbbbb1-0000-4000-8000-000000000001"

USERS = {
    "a_entry": "a0000000-0000-4000-8000-000000000001",
    "a_owner": "a0000000-0000-4000-8000-000000000002",
    "a_reviewer": "a0000000-0000-4000-8000-000000000003",
    "a_approver": "a0000000-0000-4000-8000-000000000004",
    "a_admin": "a0000000-0000-4000-8000-000000000005",
    "a_viewer": "a0000000-0000-4000-8000-000000000006",
    "a_entry2": "a0000000-0000-4000-8000-000000000007",
    "b_entry": "b0000000-0000-4000-8000-000000000001",
    "b_admin": "b0000000-0000-4000-8000-000000000002",
    "b_approver": "b0000000-0000-4000-8000-000000000003",
}

TOKENS: dict[str, Principal] = {
    "tok-a-entry": Principal(USERS["a_entry"], (Membership(TENANT_A, "data_entry"),)),
    "tok-a-entry2": Principal(USERS["a_entry2"], (Membership(TENANT_A, "data_entry"),)),
    "tok-a-owner": Principal(USERS["a_owner"], (Membership(TENANT_A, "data_owner"),)),
    "tok-a-reviewer": Principal(USERS["a_reviewer"], (Membership(TENANT_A, "reviewer"),)),
    "tok-a-approver": Principal(USERS["a_approver"], (Membership(TENANT_A, "approver"),)),
    "tok-a-admin": Principal(USERS["a_admin"], (Membership(TENANT_A, "admin"),)),
    "tok-a-viewer": Principal(USERS["a_viewer"], (Membership(TENANT_A, "viewer"),)),
    # "a_entry" ayrıca onaylayan rolüne de sahip: görevlerin ayrılığı testinde kullanılır
    "tok-a-entry-approver": Principal(USERS["a_entry"], (Membership(TENANT_A, "data_entry"), Membership(TENANT_A, "approver"))),
    "tok-b-entry": Principal(USERS["b_entry"], (Membership(TENANT_B, "data_entry"),)),
    "tok-b-admin": Principal(USERS["b_admin"], (Membership(TENANT_B, "admin"),)),
    "tok-b-approver": Principal(USERS["b_approver"], (Membership(TENANT_B, "approver"),)),
}


def headers(token: str, tenant: str, **extra: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "X-Tenant": tenant, **extra}


def build_repo(catalog: dict[str, Any] | None = None, *, allow_self_approval_a: bool = False) -> InMemoryRepo:
    repo = InMemoryRepo()
    repo.add_organization(Organization(TENANT_A, "Kurum A", {"allow_self_approval": allow_self_approval_a}))
    repo.add_organization(Organization(TENANT_B, "Kurum B", {"allow_self_approval": False}))
    repo.add_period(Period(PERIOD_A, TENANT_A, "2026-01-01", "2026-12-31"))
    repo.add_period(Period(PERIOD_B, TENANT_B, "2026-01-01", "2026-12-31"))
    for f in (catalog or {}).get("factors", []):
        repo.add_factor(f)
    for m in (catalog or {}).get("methods", []):
        repo.add_method(m)
    return repo


def build_app(catalog: dict[str, Any] | None = None, **kw: Any):
    repo = build_repo(catalog, **kw)
    return create_app(repo=repo, token_store=DevTokenStore(TOKENS)), repo


# ---------------------------------------------------------------------------
# Motor taklidi — yalnız koza_calc kurulu değilse. Sözleşme biçimini taklit eder; gerçek motor değildir.
# ---------------------------------------------------------------------------


def _num(d: Decimal) -> str:
    """Üstel gösterimsiz, normalize ondalık dize (sözleşme: "5000", "0.4")."""
    return format(d.normalize(), "f")


def _stub_calculate(request: dict[str, Any]) -> dict[str, Any]:
    canonical = json.dumps(request, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    inputs_hash = "sha256:" + hashlib.sha256(canonical.encode()).hexdigest()
    act = request["activity"]
    factors = request["factors"]
    gwp = request["method"].get("gwp_set", {})
    blocks: list[dict[str, Any]] = []
    if not isinstance(act.get("quantity"), str):
        blocks.append({"code": "INVALID_NUMBER", "field": "activity.quantity", "message_tr": "Miktar ondalık dize olmalı."})
    if act.get("unit") == "m3" and not act.get("reference_conditions"):
        blocks.append({"code": "UNIT_CONDITIONS_UNKNOWN", "field": "activity.reference_conditions", "message_tr": "m3 koşulları bilinmiyor."})
    base = {"engine_version": "0.0.0-stub", "method": {"id": request["method"]["id"], "version": request["method"]["version"]},
            "warnings": [], "boundary": factors[0].get("boundary") if factors else None, "inputs_hash": inputs_hash}
    if blocks:
        return {**base, "status": "blocked", "blocks": blocks, "normalized_activity": None, "components": [],
                "total_co2e_kg": None, "coverage": None, "claim_tr": "Hesaplanamadı."}
    q = Decimal(act["quantity"])
    components, total = [], Decimal(0)
    for f in factors:
        mass = q * Decimal(f["value"])
        gas = f["gas"]
        g = None if gas in ("CO2", "CO2e") else Decimal(gwp[gas])
        co2e = mass if g is None else mass * g
        total += co2e
        components.append({"gas": gas, "factor_id": f["id"], "factor_version": f["version"],
                           "mass_kg": _num(mass), "gwp": None if g is None else str(g),
                           "gwp_applied": g is not None, "co2e_kg": _num(co2e)})
    gases = {c["gas"] for c in components}
    coverage = "co2e_factor" if gases == {"CO2e"} else "co2_only" if gases == {"CO2"} else "full_ghg" if gases >= {"CO2", "CH4", "N2O"} else "partial_ghg"
    status = "review_required" if act.get("data_quality") == "estimated" or act.get("basis_conversion") else "computed"
    return {**base, "status": status, "blocks": [], "normalized_activity": {"quantity": act["quantity"], "unit": act["unit"], "basis": act.get("heating_value_basis")},
            "components": components, "total_co2e_kg": _num(total), "coverage": coverage,
            "claim_tr": "Yalnız CO₂ bileşeni; tam CO₂e sonucu değildir." if coverage == "co2_only" else "Taklit motor sonucu."}


def ensure_calc_engine() -> str:
    """Gerçek `koza_calc` varsa onu bırakır; yoksa sys.modules'a taklit koyar. Döner: 'real' | 'stub'."""
    try:
        import koza_calc  # noqa: F401
        return "real"
    except ImportError:
        mod = types.ModuleType("koza_calc")
        mod.calculate = _stub_calculate  # type: ignore[attr-defined]
        mod.ENGINE_VERSION = "0.0.0-stub"  # type: ignore[attr-defined]
        sys.modules["koza_calc"] = mod
        return "stub"
