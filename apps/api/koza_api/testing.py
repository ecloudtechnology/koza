"""Test yardımcıları: sabit kurum/kullanıcı kimlikleri, token deposu, uygulama kurucu (bellek içi veya PostgreSQL), motor taklidi.

Faktör DEĞERLERİ burada değildir; `tests/fixtures/test_catalog.json` altında yaşar (kural 12).

PostgreSQL test kümesi: `KOZA_TEST_DATABASE_URL` (şema sahibi/süper kullanıcı DSN'i) verilirse kullanılır; verilmezse
`initdb`/`pg_ctl` bulunabiliyorsa geçici bir küme başlatılır (TCP, unix soketi kapalı). Uygulama `koza_app` rolüyle bağlanır
(NOBYPASSRLS, DELETE yok); tablo temizliği ve kurumlar arası inceleme yalnız sahip DSN'i ile yapılır.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import types
from decimal import Decimal
from pathlib import Path
from typing import Any

from .auth import DevTokenStore, Membership, Principal, dev_jti
from .main import create_app
from .repo import InMemoryRepo, Organization, Period, User
from .security import SecurityPolicy

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
    "a_editor": "a0000000-0000-4000-8000-000000000008",
    "a_admin_nomfa": "a0000000-0000-4000-8000-000000000009",
    "b_entry": "b0000000-0000-4000-8000-000000000001",
    "b_admin": "b0000000-0000-4000-8000-000000000002",
    "b_approver": "b0000000-0000-4000-8000-000000000003",
}


def _p(token: str, user: str, *memberships: tuple[str, str], mfa: bool = True) -> Principal:
    return Principal(USERS[user], tuple(Membership(t, r) for t, r in memberships), jti=dev_jti(token), mfa_verified=mfa)


TOKENS: dict[str, Principal] = {
    "tok-a-entry": _p("tok-a-entry", "a_entry", (TENANT_A, "data_entry")),
    "tok-a-entry2": _p("tok-a-entry2", "a_entry2", (TENANT_A, "data_entry")),
    "tok-a-owner": _p("tok-a-owner", "a_owner", (TENANT_A, "data_owner")),
    "tok-a-reviewer": _p("tok-a-reviewer", "a_reviewer", (TENANT_A, "reviewer")),
    "tok-a-approver": _p("tok-a-approver", "a_approver", (TENANT_A, "approver")),
    "tok-a-admin": _p("tok-a-admin", "a_admin", (TENANT_A, "admin")),
    "tok-a-admin-nomfa": _p("tok-a-admin-nomfa", "a_admin_nomfa", (TENANT_A, "admin"), mfa=False),
    "tok-a-viewer": _p("tok-a-viewer", "a_viewer", (TENANT_A, "viewer")),
    "tok-a-editor": _p("tok-a-editor", "a_editor", (TENANT_A, "content_editor")),
    # "a_entry" ayrıca onaylayan rolüne de sahip: görevlerin ayrılığı testinde kullanılır
    "tok-a-entry-approver": _p("tok-a-entry-approver", "a_entry", (TENANT_A, "data_entry"), (TENANT_A, "approver")),
    "tok-b-entry": _p("tok-b-entry", "b_entry", (TENANT_B, "data_entry")),
    "tok-b-admin": _p("tok-b-admin", "b_admin", (TENANT_B, "admin")),
    "tok-b-approver": _p("tok-b-approver", "b_approver", (TENANT_B, "approver")),
}

# Test politikası: hız sınırı kapalı (testler ardışık yüzlerce istek atar); MFA yöneticide zorunlu (tok-a-admin mfa=True).
TEST_POLICY = SecurityPolicy(admin_mfa_required=True, rate_limit_rps=0, rate_limit_burst=0,
                             evidence_max_bytes=1024 * 1024, evidence_allowed_types=SecurityPolicy.from_env({}).evidence_allowed_types,
                             signed_url_ttl=300, signed_url_max_ttl=900)


def headers(token: str, tenant: str, **extra: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "X-Tenant": tenant, **extra}


def seed(repo, catalog: dict[str, Any] | None = None, *, allow_self_approval_a: bool = False) -> None:
    """Her iki depo için aynı tohum: kurumlar, kullanıcılar, üyelikler, dönemler, kurgusal katalog."""
    for key, uid in USERS.items():
        repo.add_user(User(id=uid, email=f"{key}@ornek.test", display_name=key.replace("_", " ")))
    repo.add_organization(Organization(TENANT_A, "Kurum A", {"allow_self_approval": allow_self_approval_a}))
    repo.add_organization(Organization(TENANT_B, "Kurum B", {"allow_self_approval": False}))
    for principal in TOKENS.values():
        for m in principal.memberships or ():
            repo.add_membership(m.tenant_id, principal.user_id, m.role, None)
    repo.add_period(Period(PERIOD_A, TENANT_A, "2026-01-01", "2026-12-31"))
    repo.add_period(Period(PERIOD_B, TENANT_B, "2026-01-01", "2026-12-31"))
    for f in (catalog or {}).get("factors", []):
        repo.add_factor(f)
    for m in (catalog or {}).get("methods", []):
        repo.add_method(m)


def build_repo(catalog: dict[str, Any] | None = None, *, allow_self_approval_a: bool = False) -> InMemoryRepo:
    repo = InMemoryRepo()
    seed(repo, catalog, allow_self_approval_a=allow_self_approval_a)
    return repo


def build_app(catalog: dict[str, Any] | None = None, *, repo=None, allow_self_approval_a: bool = False, **kw: Any):
    """repo=None → bellek içi. PostgresRepo verilirse tablolar temizlenip aynı tohum yüklenir."""
    if repo is None:
        repo = build_repo(catalog, allow_self_approval_a=allow_self_approval_a)
    else:
        repo.reset_for_tests()
        seed(repo, catalog, allow_self_approval_a=allow_self_approval_a)
    kw.setdefault("security", TEST_POLICY)
    kw.setdefault("env", {})
    return create_app(repo=repo, token_store=DevTokenStore(TOKENS), **kw), repo


# ---------------------------------------------------------------------------
# PostgreSQL test kümesi
# ---------------------------------------------------------------------------

PG_BIN_CANDIDATES = (
    "/opt/homebrew/opt/postgresql@15/bin", "/opt/homebrew/opt/postgresql@16/bin", "/opt/homebrew/opt/postgresql@17/bin",
    "/usr/lib/postgresql/17/bin", "/usr/lib/postgresql/16/bin", "/usr/lib/postgresql/15/bin", "/usr/local/pgsql/bin",
)


def _find_pg_bin() -> str | None:
    for name in ("pg_ctl", "initdb"):
        found = shutil.which(name)
        if found:
            return str(Path(found).parent)
    for cand in PG_BIN_CANDIDATES:
        if (Path(cand) / "pg_ctl").exists() and (Path(cand) / "initdb").exists():
            return cand
    return None


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class TemporaryCluster:
    """Geçici PostgreSQL kümesi (TCP yalnız; unix soketi kapalı — uzun yol hatasını önler)."""

    def __init__(self, bin_dir: str) -> None:
        self.bin = Path(bin_dir)
        self.dir = Path(tempfile.mkdtemp(prefix="koza-pg-"))
        self.port = _free_port()
        self.dsn = f"postgresql://koza@127.0.0.1:{self.port}/koza_test"
        self.admin_dsn = f"postgresql://koza@127.0.0.1:{self.port}/postgres"

    def start(self) -> None:
        data = self.dir / "data"
        subprocess.run([str(self.bin / "initdb"), "-D", str(data), "-U", "koza", "--auth=trust", "-E", "UTF8"],
                       check=True, capture_output=True)
        subprocess.run([str(self.bin / "pg_ctl"), "-D", str(data), "-l", str(self.dir / "server.log"), "-w", "start",
                        "-o", f"-p {self.port} -c unix_socket_directories='' -c listen_addresses=127.0.0.1 -c fsync=off"],
                       check=True, capture_output=True)
        import psycopg

        with psycopg.connect(self.admin_dsn, autocommit=True) as conn:
            conn.execute("CREATE DATABASE koza_test")

    def stop(self) -> None:
        subprocess.run([str(self.bin / "pg_ctl"), "-D", str(self.dir / "data"), "-m", "immediate", "stop"], capture_output=True)
        shutil.rmtree(self.dir, ignore_errors=True)


def prepare_postgres() -> tuple[Any, str] | tuple[None, str]:
    """Döner: (PostgresRepo, açıklama) ya da (None, atlama nedeni). Göçleri uygular ve koza_app rolünü yetkilendirir."""
    try:
        import psycopg  # noqa: F401
    except ImportError:
        return None, "psycopg kurulu değil"
    owner_dsn = os.environ.get("KOZA_TEST_DATABASE_URL", "").strip()
    cluster = None
    if not owner_dsn:
        bin_dir = _find_pg_bin()
        if bin_dir is None:
            return None, "KOZA_TEST_DATABASE_URL yok ve pg_ctl/initdb bulunamadı"
        cluster = TemporaryCluster(bin_dir)
        try:
            cluster.start()
        except (subprocess.CalledProcessError, OSError) as exc:
            detail = getattr(exc, "stderr", b"") or b""
            return None, f"geçici PostgreSQL başlatılamadı: {detail.decode(errors='replace')[:200] or exc}"
        owner_dsn = cluster.dsn
    import psycopg

    from .repo_postgres import PostgresRepo

    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    import migrate  # type: ignore[import-not-found]

    with psycopg.connect(owner_dsn, autocommit=True) as conn:
        migrate.down(conn, 0)
        migrate.up(conn, None)
        migrate.grant(conn, "koza_app", None)
    app_dsn = psycopg.conninfo.make_conninfo(owner_dsn, user="koza_app")
    repo = PostgresRepo(app_dsn, inspect_dsn=owner_dsn)
    repo._cluster = cluster  # type: ignore[attr-defined]
    return repo, ("geçici küme " + cluster.dsn) if cluster else owner_dsn


def teardown_postgres(repo) -> None:
    cluster = getattr(repo, "_cluster", None)
    if cluster is not None:
        cluster.stop()


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
