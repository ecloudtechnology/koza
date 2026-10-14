"""Göç çalıştırıcısı (§26: sürümlü, geri dönüş planlı).

Kullanım (depo kökünden):
    python apps/api/scripts/migrate.py up   [--to N] [--dsn ...]
    python apps/api/scripts/migrate.py down [--to N] [--dsn ...]      # --to verilmezse yalnız son sürüm geri alınır
    python apps/api/scripts/migrate.py status [--dsn ...]
    python apps/api/scripts/migrate.py grant --role koza_app [--dsn ...]

- Göç dosyaları `db/migrations/NNNN_ad.sql` ve `NNNN_ad.down.sql`; her dosya kendi BEGIN/COMMIT'ini taşır.
- Uygulanan sürümler `schema_migration(version, name, applied_at)` tablosuna yazılır.
- DSN: `--dsn` > `KOZA_MIGRATE_DATABASE_URL` > `KOZA_DATABASE_URL`. Göçler şema sahibi rolüyle koşar; uygulama
  rolü (`grant`) yalnız SELECT/INSERT/UPDATE alır — DELETE/TRUNCATE yetkisi yoktur (kural 9'un ikinci kilidi) ve
  BYPASSRLS taşımaz (kural 3).
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

try:
    import psycopg
except ImportError:  # pragma: no cover
    print("psycopg (v3) gerekli: pip install 'psycopg[binary]'", file=sys.stderr)
    raise

MIGRATIONS_DIR = Path(__file__).resolve().parents[3] / "db" / "migrations"
NAME_RE = re.compile(r"^(\d{4})_([A-Za-z0-9_\-]+)\.sql$")


def discover() -> list[tuple[int, str, Path, Path | None]]:
    out = []
    for p in sorted(MIGRATIONS_DIR.glob("*.sql")):
        m = NAME_RE.match(p.name)
        if not m:
            continue
        down = p.with_name(f"{m.group(1)}_{m.group(2)}.down.sql")
        out.append((int(m.group(1)), m.group(2), p, down if down.exists() else None))
    return out


def resolve_dsn(arg: str | None) -> str:
    dsn = arg or os.environ.get("KOZA_MIGRATE_DATABASE_URL") or os.environ.get("KOZA_DATABASE_URL")
    if not dsn:
        sys.exit("DSN yok: --dsn verin veya KOZA_DATABASE_URL ayarlayın.")
    return dsn


def ensure_table(conn: psycopg.Connection) -> None:
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migration (version integer PRIMARY KEY, name text NOT NULL, "
        "applied_at timestamptz NOT NULL DEFAULT now())"
    )


def applied(conn: psycopg.Connection) -> dict[int, str]:
    ensure_table(conn)
    return {v: n for v, n in conn.execute("SELECT version, name FROM schema_migration ORDER BY version")}


def up(conn: psycopg.Connection, to: int | None) -> list[int]:
    done = applied(conn)
    ran = []
    for version, name, path, _ in discover():
        if version in done or (to is not None and version > to):
            continue
        conn.execute(path.read_text(encoding="utf-8"))
        conn.execute("INSERT INTO schema_migration (version, name) VALUES (%s, %s)", (version, name))
        ran.append(version)
        print(f"up   {version:04d}_{name}")
    return ran


def down(conn: psycopg.Connection, to: int | None) -> list[int]:
    done = applied(conn)
    if not done:
        return []
    target = to if to is not None else max(done) - 1
    ran = []
    for version, name, _, down_path in sorted(discover(), reverse=True):
        if version not in done or version <= target:
            continue
        if down_path is None:
            sys.exit(f"{version:04d}_{name} için .down.sql yok; geri alınamaz.")
        conn.execute(down_path.read_text(encoding="utf-8"))
        conn.execute("DELETE FROM schema_migration WHERE version = %s", (version,))
        ran.append(version)
        print(f"down {version:04d}_{name}")
    return ran


def grant(conn: psycopg.Connection, role: str, password: str | None) -> None:
    if not re.fullmatch(r"[a-z_][a-z0-9_]*", role):
        sys.exit("Rol adı yalnız küçük harf/rakam/alt çizgi olabilir.")
    lit = psycopg.sql.Literal(role).as_string(conn)
    conn.execute(
        f"DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = {lit}) THEN "
        f"EXECUTE format('CREATE ROLE %I LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE', {lit}); END IF; END $$;"
    )
    if password:
        conn.execute(psycopg.sql.SQL("ALTER ROLE {} WITH PASSWORD {}").format(psycopg.sql.Identifier(role), psycopg.sql.Literal(password)))
    ident = psycopg.sql.Identifier(role)
    conn.execute(psycopg.sql.SQL("GRANT USAGE ON SCHEMA public TO {}").format(ident))
    conn.execute(psycopg.sql.SQL("GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO {}").format(ident))
    conn.execute(psycopg.sql.SQL("REVOKE ALL ON schema_migration FROM {}").format(ident))
    conn.execute(psycopg.sql.SQL("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {}").format(ident))
    conn.execute(psycopg.sql.SQL("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO {}").format(ident))
    conn.execute(psycopg.sql.SQL("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO {}").format(ident))
    print(f"grant {role}: SELECT/INSERT/UPDATE (DELETE yok, BYPASSRLS yok)")


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["up", "down", "status", "grant"])
    ap.add_argument("--to", type=int, default=None)
    ap.add_argument("--dsn", default=None)
    ap.add_argument("--role", default="koza_app")
    ap.add_argument("--password", default=None, help="grant: rol parolası (boşsa değiştirilmez)")
    args = ap.parse_args(argv)
    dsn = resolve_dsn(args.dsn)
    with psycopg.connect(dsn, autocommit=True) as conn:
        if args.command == "status":
            done = applied(conn)
            for version, name, _, down_path in discover():
                mark = "uygulandı" if version in done else "bekliyor"
                print(f"{version:04d}_{name:<24} {mark}{'' if down_path else '  (down yok)'}")
            return
        if args.command == "up":
            ran = up(conn, args.to)
            print(f"{len(ran)} göç uygulandı." if ran else "Güncel; uygulanacak göç yok.")
        elif args.command == "down":
            ran = down(conn, args.to)
            print(f"{len(ran)} göç geri alındı." if ran else "Geri alınacak göç yok.")
        elif args.command == "grant":
            grant(conn, args.role, args.password)


if __name__ == "__main__":
    main()
