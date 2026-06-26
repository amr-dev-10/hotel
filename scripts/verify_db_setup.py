from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

import app.models  # noqa: E402,F401
from alembic.config import Config  # noqa: E402
from alembic.migration import MigrationContext  # noqa: E402
from alembic.script import ScriptDirectory  # noqa: E402
from app.core.database import Base, engine  # noqa: E402


CORE_TABLES = (
    "hotels",
    "users",
    "roles",
    "permissions",
    "role_permissions",
    "departments",
    "rooms",
    "room_types",
    "guests",
    "reservations",
    "tickets",
    "alembic_version",
)

REQUIRED_POSTGRES_EXTENSIONS = ("pgcrypto", "btree_gist", "pg_trgm")
ROOM_BLOCK_CONSTRAINT = "room_blocks_no_room_overlap"


@dataclass
class CheckResult:
    name: str
    status: str
    detail: str


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify the Arcadia database setup.")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON.")
    parser.add_argument(
        "--require-demo-data",
        action="store_true",
        help="Fail if the arcadia-demo hotel has not been seeded.",
    )
    args = parser.parse_args()

    checks: list[CheckResult] = []
    errors: list[str] = []
    warnings: list[str] = []

    try:
        with engine.connect() as connection:
            if engine.dialect.name == "postgresql":
                database_name = connection.execute(text("select current_database()")).scalar_one_or_none()
            else:
                database_name = engine.url.database
            checks.append(
                CheckResult(
                    "connection",
                    "ok",
                    f"Connected to {database_name or 'database'} using {engine.dialect.name}.",
                )
            )

            inspector = inspect(connection)
            _check_tables(inspector, checks, errors)
            _check_columns(inspector, checks, errors)
            _check_alembic(connection, checks, errors, warnings)

            if engine.dialect.name == "postgresql":
                _check_postgres_extensions(connection, checks, errors)
                _check_room_block_constraint(connection, checks, errors, warnings)
                _check_tenant_setting(connection, checks, warnings)
            else:
                checks.append(
                    CheckResult(
                        "postgresql",
                        "warning",
                        f"Dialect is {engine.dialect.name}; PostgreSQL-only checks skipped.",
                    )
                )
                warnings.append("PostgreSQL-only checks skipped.")

            _check_core_counts(connection, checks, warnings)
            if args.require_demo_data:
                _check_demo_data(connection, checks, errors)

    except SQLAlchemyError as exc:
        errors.append(f"Database verification failed: {exc}")
        checks.append(CheckResult("connection", "error", str(exc)))
    except Exception as exc:  # pragma: no cover - CLI safety net
        errors.append(f"Unexpected verification failure: {exc}")
        checks.append(CheckResult("unexpected_error", "error", str(exc)))

    payload = {
        "database_url": engine.url.render_as_string(hide_password=True),
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
        "checks": [asdict(check) for check in checks],
    }

    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        _print_human(payload)

    return 0 if not errors else 1


def _check_tables(inspector: Any, checks: list[CheckResult], errors: list[str]) -> None:
    existing = set(inspector.get_table_names())
    expected = set(Base.metadata.tables)
    missing = sorted(expected - existing)

    if missing:
        errors.append(f"Missing {len(missing)} application tables.")
        checks.append(
            CheckResult(
                "tables",
                "error",
                "Missing tables: " + ", ".join(missing[:30]) + (" ..." if len(missing) > 30 else ""),
            )
        )
        return

    checks.append(CheckResult("tables", "ok", f"All {len(expected)} SQLAlchemy tables exist."))


def _check_columns(inspector: Any, checks: list[CheckResult], errors: list[str]) -> None:
    existing_tables = set(inspector.get_table_names())
    missing_by_table: dict[str, list[str]] = {}

    for table_name, table in Base.metadata.tables.items():
        if table_name not in existing_tables:
            continue
        db_columns = {column["name"] for column in inspector.get_columns(table_name)}
        expected_columns = {column.name for column in table.columns}
        missing_columns = sorted(expected_columns - db_columns)
        if missing_columns:
            missing_by_table[table_name] = missing_columns

    if missing_by_table:
        details = "; ".join(
            f"{table}: {', '.join(columns)}" for table, columns in sorted(missing_by_table.items())[:20]
        )
        errors.append(f"Missing columns in {len(missing_by_table)} tables.")
        checks.append(CheckResult("columns", "error", details))
        return

    checks.append(CheckResult("columns", "ok", "All model columns exist in the database."))


def _check_alembic(
    connection: Any,
    checks: list[CheckResult],
    errors: list[str],
    warnings: list[str],
) -> None:
    inspector = inspect(connection)
    if "alembic_version" not in inspector.get_table_names():
        errors.append("Missing alembic_version table. Run Alembic upgrade or stamp the DB.")
        checks.append(CheckResult("alembic", "error", "alembic_version table is missing."))
        return

    config = Config(str(ROOT / "backend" / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "backend" / "alembic"))
    script = ScriptDirectory.from_config(config)
    _check_initial_migration_file(script, checks, errors, warnings)
    expected_heads = set(script.get_heads())

    context = MigrationContext.configure(connection)
    current_heads = set(context.get_current_heads())

    if not current_heads:
        errors.append("Alembic has no current revision recorded.")
        checks.append(CheckResult("alembic", "error", "No current Alembic revision."))
        return

    if current_heads != expected_heads:
        errors.append("Alembic revision is not at head.")
        checks.append(
            CheckResult(
                "alembic",
                "error",
                f"Current={sorted(current_heads)} expected={sorted(expected_heads)}.",
            )
        )
        return

    if len(expected_heads) > 1:
        warnings.append("Multiple Alembic heads exist; consider merging migration branches.")
        checks.append(CheckResult("alembic", "warning", f"At heads {sorted(expected_heads)}, but multiple heads exist."))
        return

    checks.append(CheckResult("alembic", "ok", f"Database is at Alembic head {next(iter(expected_heads))}."))


def _check_initial_migration_file(
    script: ScriptDirectory,
    checks: list[CheckResult],
    errors: list[str],
    warnings: list[str],
) -> None:
    revisions = list(script.walk_revisions())
    if not revisions:
        errors.append("No Alembic migration files were found.")
        checks.append(CheckResult("migration_files", "error", "backend/alembic/versions has no migrations."))
        return

    base_revisions = [revision for revision in revisions if revision.down_revision is None]
    if len(revisions) == 1 and len(base_revisions) == 1:
        path = Path(base_revisions[0].path)
        content = path.read_text(encoding="utf-8")
        if "op.create_table" not in content:
            errors.append(
                "The single initial Alembic migration does not create tables. "
                "Regenerate it against an empty database."
            )
            checks.append(
                CheckResult(
                    "migration_files",
                    "error",
                    f"{path.name} has no op.create_table(...) calls.",
                )
            )
            return
        checks.append(CheckResult("migration_files", "ok", f"{path.name} looks like a table-creating initial migration."))
        return

    if len(base_revisions) != 1:
        warnings.append("Alembic history has multiple or zero base revisions.")
        checks.append(
            CheckResult(
                "migration_files",
                "warning",
                f"{len(revisions)} revisions, {len(base_revisions)} base revisions.",
            )
        )
        return

    checks.append(CheckResult("migration_files", "ok", f"Alembic history has {len(revisions)} migration files."))


def _check_postgres_extensions(connection: Any, checks: list[CheckResult], errors: list[str]) -> None:
    rows = connection.execute(text("select extname from pg_extension")).scalars().all()
    installed = set(rows)
    missing = [extension for extension in REQUIRED_POSTGRES_EXTENSIONS if extension not in installed]
    if missing:
        errors.append("Missing PostgreSQL extensions: " + ", ".join(missing))
        checks.append(CheckResult("postgres_extensions", "error", "Missing: " + ", ".join(missing)))
        return
    checks.append(
        CheckResult(
            "postgres_extensions",
            "ok",
            "Installed: " + ", ".join(REQUIRED_POSTGRES_EXTENSIONS),
        )
    )


def _check_room_block_constraint(
    connection: Any,
    checks: list[CheckResult],
    errors: list[str],
    warnings: list[str],
) -> None:
    table_exists = connection.execute(text("select to_regclass('public.room_blocks') is not null")).scalar_one()
    if not table_exists:
        warnings.append("room_blocks table is missing; constraint check skipped.")
        checks.append(CheckResult("room_block_constraint", "warning", "room_blocks table does not exist."))
        return

    exists = connection.execute(
        text(
            """
            select exists (
              select 1
              from pg_constraint
              where conname = :constraint_name
                and conrelid = 'public.room_blocks'::regclass
            )
            """
        ),
        {"constraint_name": ROOM_BLOCK_CONSTRAINT},
    ).scalar_one()
    if not exists:
        errors.append(f"Missing PostgreSQL constraint {ROOM_BLOCK_CONSTRAINT}.")
        checks.append(CheckResult("room_block_constraint", "error", f"{ROOM_BLOCK_CONSTRAINT} is missing."))
        return
    checks.append(CheckResult("room_block_constraint", "ok", f"{ROOM_BLOCK_CONSTRAINT} exists."))


def _check_tenant_setting(connection: Any, checks: list[CheckResult], warnings: list[str]) -> None:
    value = connection.execute(text("select current_setting('app.current_hotel_id', true)")).scalar_one_or_none()
    if value is None:
        warnings.append("Database default app.current_hotel_id is not set.")
        checks.append(CheckResult("tenant_setting", "warning", "app.current_hotel_id has no database default."))
        return
    checks.append(CheckResult("tenant_setting", "ok", "app.current_hotel_id is available."))


def _check_core_counts(connection: Any, checks: list[CheckResult], warnings: list[str]) -> None:
    inspector = inspect(connection)
    existing = set(inspector.get_table_names())
    counts: dict[str, int] = {}

    for table_name in CORE_TABLES:
        if table_name not in existing:
            continue
        counts[table_name] = int(connection.execute(text(f"select count(*) from {table_name}")).scalar_one())

    if not counts:
        warnings.append("No core table counts available.")
        checks.append(CheckResult("core_counts", "warning", "No core tables found."))
        return

    detail = ", ".join(f"{table}={count}" for table, count in counts.items())
    checks.append(CheckResult("core_counts", "ok", detail))


def _check_demo_data(connection: Any, checks: list[CheckResult], errors: list[str]) -> None:
    inspector = inspect(connection)
    existing = set(inspector.get_table_names())
    required = {"hotels", "users"}
    if not required.issubset(existing):
        errors.append("Cannot verify demo data because hotels/users tables are missing.")
        checks.append(CheckResult("demo_data", "error", "hotels/users tables are missing."))
        return

    hotel_id = connection.execute(
        text("select id from hotels where slug = 'arcadia-demo' limit 1")
    ).scalar_one_or_none()
    owner_id = connection.execute(
        text("select id from users where email = 'owner@arcadia.demo' limit 1")
    ).scalar_one_or_none()

    if not hotel_id or not owner_id:
        errors.append("Demo data is missing. Run scripts/seed_demo_data.py.")
        checks.append(CheckResult("demo_data", "error", "arcadia-demo hotel or owner@arcadia.demo is missing."))
        return

    checks.append(CheckResult("demo_data", "ok", "arcadia-demo and owner@arcadia.demo exist."))


def _print_human(payload: dict[str, Any]) -> None:
    print(f"Database URL: {payload['database_url']}")
    print(f"Status: {'OK' if payload['ok'] else 'FAILED'}")
    print()
    for check in payload["checks"]:
        marker = {"ok": "[OK]", "warning": "[WARN]", "error": "[FAIL]"}.get(check["status"], "[INFO]")
        print(f"{marker} {check['name']}: {check['detail']}")

    if payload["warnings"]:
        print("\nWarnings:")
        for warning in payload["warnings"]:
            print(f"- {warning}")

    if payload["errors"]:
        print("\nErrors:")
        for error in payload["errors"]:
            print(f"- {error}")


if __name__ == "__main__":
    raise SystemExit(main())
