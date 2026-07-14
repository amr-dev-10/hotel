# Arcadia Application Setup

Last updated: 2026-06-23

Follow this file from top to bottom to set up the Arcadia hotel platform locally. It covers PostgreSQL, Redis, backend, frontend, demo data, and verification commands.

## 1. Prerequisites

Install:

- Python 3.12
- Node.js with Corepack or `pnpm`
- PostgreSQL 16 or a compatible PostgreSQL version
- Redis 7 or a compatible Redis version
- Docker Desktop, optional but recommended for local PostgreSQL and Redis

Use PowerShell from the repo root:

```powershell
cd "C:\Users\Lenovo\Documents\Hotel Managment"
```

## 2. Start PostgreSQL And Redis

Recommended local setup with Docker:

```powershell
docker compose up -d postgres redis
```

Docker defaults from `docker-compose.yml`:

```text
PostgreSQL host: localhost
PostgreSQL port: 5432
PostgreSQL database: arcadia
PostgreSQL admin user: postgres
PostgreSQL admin password: postgres
Redis URL: redis://localhost:6379/0
```

If you use a manually installed Windows PostgreSQL, keep it running on `localhost:5432`.

## 3. Create The PostgreSQL Database

Use the reusable SQL bootstrap file:

```powershell
psql -U postgres -h localhost -f scripts\postgres_setup.sql -v app_db=arcadia -v app_user=arcadia -v app_password='StrongPassword123'
```

This creates or updates:

- application database
- application login role
- schema owner and privileges
- required extensions: `pgcrypto`, `btree_gist`, `pg_trgm`
- default privileges for future migration-created objects
- guarded post-migration hardening for `room_blocks`

For production, use production names and a strong secret:

```powershell
psql -U postgres -h <db-host> -f scripts\postgres_setup.sql -v app_db=arcadia_prod -v app_user=arcadia_app -v app_password='<replace-with-strong-secret>'
```

Production database URL format:

```text
postgresql+psycopg://arcadia_app:<replace-with-strong-secret>@<db-host>:5432/arcadia_prod
```

## 4. Configure Backend Environment

Create `backend\.env` if missing:

```powershell
if (-not (Test-Path backend\.env)) { Copy-Item backend\.env.example backend\.env }
```

For the Docker/local database created above, set these values in `backend\.env`:

```env
APP_NAME=Arcadia Hotel Platform
ENVIRONMENT=development
DATABASE_URL=postgresql+psycopg://arcadia:StrongPassword123@localhost:5432/arcadia
AUTO_CREATE_TABLES=true

JWT_SECRET=change-this-development-secret-minimum-32-chars
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=720
REFRESH_TOKEN_EXPIRE_DAYS=30

REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

WHATSAPP_DRY_RUN=true
FCM_ENABLED=false
DEFAULT_TIMEZONE=UTC

PLATFORM_ADMIN_NAME=Arcadia Admin
PLATFORM_ADMIN_EMAIL=admin@arcadia.io
PLATFORM_ADMIN_PASSWORD=ArcadiaAdmin123!
```

For the existing Windows PostgreSQL database on this machine, use this `DATABASE_URL` instead:

```env
DATABASE_URL=postgresql+psycopg://arcadia:StrongPassword123@localhost:5432/hotel_management
```

Do not commit real production secrets or third-party API tokens.

## 5. Install Backend Dependencies

Create the Windows backend virtual environment:

```powershell
py -3.12 -m venv .venv-win
.\.venv-win\Scripts\python.exe -m pip install --upgrade pip
.\.venv-win\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Use `.\.venv-win\Scripts\python.exe` for backend commands on Windows.

## 6. Create Or Migrate App Tables

Run every command in this section from a Windows PowerShell terminal at the repo root:

```powershell
cd "C:\Users\Lenovo\Documents\Hotel Managment"
```

Before running these commands, confirm:

- PostgreSQL is running.
- Step 3 has created the database and app user.
- `backend\.env` exists.
- `DATABASE_URL` in `backend\.env` points to the database you want to set up.
- `.venv-win` exists and backend dependencies are installed from Step 5.

For a new development setup in this project, the normal order is:

1. Run `scripts\postgres_setup.sql` from Step 3 to create the PostgreSQL database and user.
2. Generate or use a clean initial Alembic migration.
3. Run `alembic upgrade head` to create app tables.
4. Run `scripts\postgres_setup.sql` again to reapply grants and PostgreSQL hardening.
5. Seed demo data from Step 10.

Choose one path below.

## 6.1 -> Clean Initial Migration For This Not-Deployed Project

Use this path when the project has not been deployed anywhere and you intentionally want to reset migration history.

Keep these Alembic files:

```text
backend\alembic.ini
backend\alembic\env.py
backend\alembic\script.py.mako
backend\alembic\versions\.gitkeep
```

Remove old migration Python files from:

```text
backend\alembic\versions\*.py
```

Then use an empty PostgreSQL database. Either drop and recreate the dev database, or use a new database name. The migration autogenerate command must compare the SQLAlchemy models against an empty database. If you run autogenerate against a database that already has tables, Alembic will not generate the `op.create_table(...)` commands needed for a real initial migration.

Run the PostgreSQL bootstrap from Step 3 for the empty database:

```powershell
psql -U postgres -h localhost -f scripts\postgres_setup.sql -v app_db=arcadia -v app_user=arcadia -v app_password='StrongPassword123'
```

Confirm `backend\.env` points to that same empty database:

```env
DATABASE_URL=postgresql+psycopg://arcadia:StrongPassword123@localhost:5432/arcadia
```

Generate one clean initial migration:

```powershell
.\.venv-win\Scripts\alembic.exe -c backend\alembic.ini revision --autogenerate -m "initial_schema"
```

Open the generated file in `backend\alembic\versions`. It should contain many `op.create_table(...)` calls for core tables such as `hotels`, `users`, `roles`, `tickets`, `reservations`, and related tables. If it only contains a few constraints or indexes, the database was not empty; delete that generated migration, empty the database, and generate it again.

Apply the clean migration:

```powershell
.\.venv-win\Scripts\alembic.exe -c backend\alembic.ini upgrade head
```

Run the PostgreSQL bootstrap SQL again after tables exist:

```powershell
psql -U postgres -h localhost -f scripts\postgres_setup.sql -v app_db=arcadia -v app_user=arcadia -v app_password='StrongPassword123'
```

This is the cleanest setup because any new developer can create the full database with just `alembic upgrade head`.

## 6.2 -> Existing Database

If the database already has app tables, run migrations:

```powershell
.\.venv-win\Scripts\alembic.exe -c backend\alembic.ini upgrade head
```

Use this path after pulling new code, after adding Alembic migration files, or when setting up a production/staging database that should be migrated forward.

### 6.3 -> Local Shortcut Without A Real Migration

This shortcut is acceptable only for disposable local work when you do not need Alembic to create the database from scratch. It creates tables directly from the current SQLAlchemy models:

```powershell
@'
import sys
sys.path.insert(0, "backend")
from app.core.database import init_db

init_db()
print("schema_created")
'@ | .\.venv-win\Scripts\python.exe -
```

Then stamp Alembic as current:

```powershell
.\.venv-win\Scripts\alembic.exe -c backend\alembic.ini stamp head
```

Use this local shortcut only when the database is empty. Do not use it for production or for a migration history you want other developers to rely on.

After tables exist, run the PostgreSQL bootstrap SQL again from the same repo-root PowerShell terminal to reapply grants and guarded PostgreSQL hardening:

```powershell
psql -U postgres -h localhost -f scripts\postgres_setup.sql -v app_db=arcadia -v app_user=arcadia -v app_password='StrongPassword123'
```

### 6.4 -> Verify Database Setup

After creating or migrating tables, run the read-only database verifier from the repo root:

```powershell
.\.venv-win\Scripts\python.exe scripts\verify_db_setup.py
```

After demo seeding, verify that demo data exists too:

```powershell
.\.venv-win\Scripts\python.exe scripts\verify_db_setup.py --require-demo-data
```

Check that Alembic sees no model/schema drift:

```powershell
.\.venv-win\Scripts\alembic.exe -c backend\alembic.ini check
```

The verifier checks database connectivity, expected SQLAlchemy tables and columns, Alembic head state, PostgreSQL extensions, the `room_blocks` overlap constraint, and basic core table row counts.

Common verifier failures:

- `initial migration does not create tables`: the migration was autogenerated while the database already had tables. Delete that migration, empty the database, and regenerate it with `alembic revision --autogenerate -m "initial_schema"`.
- `room_blocks_no_room_overlap is missing`: run `scripts\postgres_setup.sql` again after tables exist, using the same database and user values from `backend\.env`.

## 7. Install Frontend Dependencies

From the repo root:

```powershell
pnpm install
```

Create dashboard env file if missing:

```powershell
if (-not (Test-Path apps\dashboard\.env.local)) { Copy-Item apps\dashboard\.env.example apps\dashboard\.env.local }
```

Recommended local dashboard env:

```env
NEXT_PUBLIC_API_BASE_URL=/api/v1
API_PROXY_TARGET=http://localhost:8000
NEXT_PUBLIC_WS_BASE_URL=ws://localhost:8000
```

## 8. Start The Backend

Run:

```powershell
.\.venv-win\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

Open:

- `http://127.0.0.1:8000/health`
- `http://127.0.0.1:8000/docs`

## 9. Start The Dashboard

In another PowerShell window:

```powershell
pnpm run dev:dashboard
```

Open:

- Hotel login: `http://localhost:3000/login`
- Platform login: `http://localhost:3000/platform/login`

## 10. Seed Demo Data

Run:

```powershell
.\.venv-win\Scripts\python.exe scripts\seed_demo_data.py
```

Or, with the backend running:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/v1/hotels/demo-seed
```

Demo hotel login:

```text
Email: owner@arcadia.demo
Password: DemoPass123!
```

The demo seed creates or reuses hotel slug `arcadia-demo` and inserts sample rooms, staff, guests, reservations, tickets, housekeeping tasks, and analytics data. It is disabled when `ENVIRONMENT=production`.

All demo hotel users created by the seed use the shared demo password:

```text
DemoPass123!
```

## 11. Seed Platform Admin

Make sure `PLATFORM_ADMIN_*` values are set in `backend\.env`, then run:

```powershell
$env:PYTHONPATH = "backend"
.\.venv-win\Scripts\python.exe -m app.seeds.seed_platform_admin
```

Platform admin login:

```text
URL: http://localhost:3000/platform/login
Email: admin@arcadia.io
Password: value of PLATFORM_ADMIN_PASSWORD
```

## 12. Reset Local Development Data

Use only for disposable local development data:

```powershell
.\.venv-win\Scripts\python.exe scripts\reset_dev_db_and_seed.py --yes
```

This drops the local schema, recreates tables, and seeds demo data. It refuses to run when `ENVIRONMENT=production`.

## 13. Run Backend Tests

Full backend test suite:

```powershell
.\.venv-win\Scripts\python.exe -m pytest backend\tests
```

Focused test groups:

```powershell
.\.venv-win\Scripts\python.exe -m pytest -m unit
.\.venv-win\Scripts\python.exe -m pytest -m integration
.\.venv-win\Scripts\python.exe -m pytest -m rbac
.\.venv-win\Scripts\python.exe -m pytest -m sla
.\.venv-win\Scripts\python.exe -m pytest -m performance
```

The test suite uses an isolated SQLite test database from `backend\tests\conftest.py`.

## 14. Run Frontend Checks

The dashboard currently uses lint, production build, and TypeScript checking as the frontend verification gate:

```powershell
pnpm --filter @arcadia/dashboard lint
pnpm --filter @arcadia/dashboard build
pnpm --filter @arcadia/dashboard typecheck
```

If `typecheck` reports missing `.next/types` files, run the build once and then rerun typecheck:

```powershell
pnpm --filter @arcadia/dashboard build
pnpm --filter @arcadia/dashboard typecheck
```

## 15. Optional Load Seed Data

Use this for local performance profiling, not normal development:

```powershell
.\.venv-win\Scripts\python.exe scripts\seed_load_data.py --size small
```

The command prints progress while it runs. The `multi` preset is intentionally large: 100 hotels, with 1,000 guests, 1,200 reservations, and 1,000 tickets per hotel. If it looks quiet for a while on an older version of the script, stop it with `Ctrl+C` and rerun after pulling the progress-logging update.

Dry-run a multi-tenant load seed:

```powershell
.\.venv-win\Scripts\python.exe scripts\seed_load_data.py --size multi --hotels 100 --dry-run
```

Try a smaller multi-tenant run first:

```powershell
.\.venv-win\Scripts\python.exe scripts\seed_load_data.py --size multi --hotels 2 --hotel-slug arcadia-load
```

Load seed hotel owner emails are generated from the hotel slug and use the shared demo password:

```text
owner-arcadia-load-001@arcadia.load / DemoPass123!
owner-arcadia-load-002@arcadia.load / DemoPass123!
```

Generated load staff users also use `DemoPass123!`. Their emails follow this pattern:

```text
load-staff-0001-arcadia-load-001@arcadia.load
```

Create multi-tenant load data:

```powershell
.\.venv-win\Scripts\python.exe scripts\seed_load_data.py --size multi --hotel-slug arcadia-load
```

Preset sizes:

| Size | Hotels | Rooms | Staff | Guests | Reservations | Tickets |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| small | 1 | 25 | 12 | 100 | 120 | 500 |
| medium | 1 | 100 | 40 | 1,000 | 1,200 | 5,000 |
| large | 1 | 300 | 120 | 20,000 | 25,000 | 100,000 |
| multi | 100 | 50 | 20 | 1,000 | 1,200 | 1,000 |

## 16. Daily Development Flow

1. Start services: `docker compose up -d postgres redis`
2. Run migrations: `.\.venv-win\Scripts\alembic.exe -c backend\alembic.ini upgrade head`
3. Start backend: `.\.venv-win\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000`
4. Start dashboard: `pnpm run dev:dashboard`
5. Seed demo data if needed: `.\.venv-win\Scripts\python.exe scripts\seed_demo_data.py`
6. Test backend: `.\.venv-win\Scripts\python.exe -m pytest backend\tests`
7. Check frontend: `pnpm --filter @arcadia/dashboard build`

## 17. Production Checklist

1. Use managed PostgreSQL and Redis.
2. Run `scripts\postgres_setup.sql` with production database/user/password values.
3. Set `ENVIRONMENT=production`.
4. Set `AUTO_CREATE_TABLES=false`.
5. Set strong values for `JWT_SECRET`, `ENCRYPTION_KEY`, and `VAULT_MASTER_KEY`.
6. Set real integration secrets only through production secret storage.
7. Run `alembic -c backend/alembic.ini upgrade head`.
8. Run `scripts\postgres_setup.sql` again to reapply grants and PostgreSQL hardening.
9. Do not run demo seed or reset scripts in production.

## 18. Production Super Admin Bootstrap

Create the first platform super admin as a one-time production bootstrap task. Do not hardcode the password in code, do not commit it to `.env`, and do not leave the temporary password in shell history or long-lived environment variables.

Set temporary secrets on the production server, job runner, or hosting platform secret manager:

```powershell
$env:PYTHONPATH = "backend"
$env:PLATFORM_ADMIN_NAME = "Your Company Admin"
$env:PLATFORM_ADMIN_EMAIL = "admin@yourcompany.com"
$env:PLATFORM_ADMIN_PASSWORD = "<very-strong-temporary-password>"
```

Run the bootstrap command once:

```powershell
.\.venv-win\Scripts\python.exe -m app.seeds.seed_platform_admin
```

For Linux production hosts, use the production Python environment:

```bash
export PYTHONPATH=backend
export PLATFORM_ADMIN_NAME="Your Company Admin"
export PLATFORM_ADMIN_EMAIL="admin@yourcompany.com"
export PLATFORM_ADMIN_PASSWORD="<very-strong-temporary-password>"
python -m app.seeds.seed_platform_admin
```

After the account is created:

1. Log in through `/platform/login`.
2. Change the password immediately or create named admin accounts for real operators.
3. Remove `PLATFORM_ADMIN_PASSWORD` from the server environment or delete it from the secret manager.
4. Disable or rotate the bootstrap account if it was only meant for first access.

The command is idempotent for the configured email. If the platform admin already exists, it prints that the account exists and does not overwrite the password.

# DEMO RECORDS CREDENTIAL
- App Role	Employee ID	Email	Password
- Manager / Owner	MGR001	owner@arcadia.demo	DemoPass123!
- Manager	ENG001	engineering@arcadia.demo	DemoPass123!
- Manager	HKM001	housekeeping@arcadia.demo	DemoPass123!
- Front Desk	FD001	frontdesk@arcadia.demo	DemoPass123!
- Attendant	ATT001	attendant@arcadia.demo	DemoPass123!