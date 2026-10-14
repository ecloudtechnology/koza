"""Geliştirme tohumu: KOZA_DEV_TOKENS ile TUTARLI bir kurgusal kurum, kullanıcılar, üyelikler ve açık bir dönem yazar.

Kullanım (depo kökünden, göçler uygulanmış olmalı):
    export KOZA_DATABASE_URL=postgresql://koza@127.0.0.1:5432/koza
    python apps/api/scripts/seed_dev.py                 # tohumu yazar ve KOZA_DEV_TOKENS değerini basar
    python apps/api/scripts/seed_dev.py --print-tokens  # yalnız KOZA_DEV_TOKENS JSON'unu basar (yazmaz)

Yalnız kurgusal veri: faktör/yöntem YAZMAZ (kural 12 — kataloğu uzman kontrolör /v1/factors ile ekler).
Çalıştırmak için göç sahibi DSN'i gerekir (organization INSERT'i RLS WITH CHECK'ten geçer; tohum tenant_id ayarlayarak yazar).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from koza_api.repo import Organization, Period, User  # noqa: E402

DEV_TENANT = "d0000000-0000-4000-8000-000000000001"
DEV_USERS = {
    # token            kullanıcı kimliği                          e-posta                 rol
    "dev-admin":    ("d0000000-0000-4000-8000-0000000000a1", "yonetici@kurgusal.test",  "admin"),
    "dev-entry":    ("d0000000-0000-4000-8000-0000000000a2", "veri@kurgusal.test",      "data_entry"),
    "dev-owner":    ("d0000000-0000-4000-8000-0000000000a3", "sorumlu@kurgusal.test",   "data_owner"),
    "dev-reviewer": ("d0000000-0000-4000-8000-0000000000a4", "kontrolor@kurgusal.test", "reviewer"),
    "dev-approver": ("d0000000-0000-4000-8000-0000000000a5", "onay@kurgusal.test",      "approver"),
    "dev-viewer":   ("d0000000-0000-4000-8000-0000000000a6", "izleyici@kurgusal.test",  "viewer"),
    "dev-editor":   ("d0000000-0000-4000-8000-0000000000a7", "editor@kurgusal.test",    "content_editor"),
}
DEV_PERIOD = "d0000000-0000-4000-8000-0000000000e1"


def dev_tokens() -> dict:
    return {tok: {"user_id": uid, "memberships": [{"tenant_id": DEV_TENANT, "role": role}], "mfa": role == "admin"}
            for tok, (uid, _, role) in DEV_USERS.items()}


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dsn", default=None)
    ap.add_argument("--print-tokens", action="store_true")
    args = ap.parse_args(argv)
    tokens = json.dumps(dev_tokens(), ensure_ascii=False)
    if args.print_tokens:
        print(tokens)
        return
    dsn = args.dsn or os.environ.get("KOZA_MIGRATE_DATABASE_URL") or os.environ.get("KOZA_DATABASE_URL")
    if not dsn:
        sys.exit("DSN yok: --dsn verin veya KOZA_DATABASE_URL ayarlayın.")
    from koza_api.repo_postgres import PostgresRepo

    repo = PostgresRepo(dsn)
    if repo.get_organization(DEV_TENANT) is None:
        repo.add_organization(Organization(DEV_TENANT, "Kurgusal Sanayi A.Ş. (geliştirme)", {"allow_self_approval": False}))
    for tok, (uid, email, role) in DEV_USERS.items():
        repo.add_user(User(id=uid, email=email, display_name=tok.replace("dev-", "Geliştirme ").title()))
        repo.add_membership(DEV_TENANT, uid, role, None)
    if repo.get_period(DEV_TENANT, DEV_PERIOD) is None:
        repo.add_period(Period(DEV_PERIOD, DEV_TENANT, "2026-01-01", "2026-12-31"))
    print(f"tohum yazıldı: kurum {DEV_TENANT}, {len(DEV_USERS)} kullanıcı, dönem {DEV_PERIOD}")
    print("export KOZA_DEV_TOKENS='" + tokens.replace("'", "'\\''") + "'")
    print(f"# X-Tenant: {DEV_TENANT}")


if __name__ == "__main__":
    main()
