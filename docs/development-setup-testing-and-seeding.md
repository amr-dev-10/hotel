# Development Setup, Testing, And Seeding

Last updated: 2026-06-23

This is the start-here guide for running Arcadia locally, setting up the database, running backend and frontend checks, and loading demo or performance seed data.

## 1. Prerequisites

- Windows PowerShell from the repo root: `C:\Users\Lenovo\Documents\Hotel Managment`
- Python 3.12
- Node.js with Corepack or `pnpm`
- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

The repo includes `docker-compose.yml` for PostgreSQL and Redis. If Docker is available, this is the quickest service setup:

```powershell
docker compose up -d postgres redis
```

The Docker defaults are:

```text
Database: arcadia
User: postgres
Password: postgres
Host: localhost
Port: 5432
Redis: redis://localhost:6379/0
```

## 2. Backend Environment

Create `backend\.env` if it does not already exist:

```powershell
if (-not (Test-Path backend\.env)) { Copy-Item backend\.env.example backend\.env }
```

For the Docker database, keep:

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/arcadia
ENVIRONMENT=development
AUTO_CREATE_TABLES=true
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2
JWT_SECRET=change-this-development-secret-minimum-32-chars
```

For the Windows PostgreSQL database already used on this machine, use:

```env
DATABASE_URL=postgresql+psycopg://arcadia:StrongPassword123@localhost:5432/hotel_management
```

Do not commit local secrets or real integration tokens from `backend\.env`.

## 3. Python Dependencies

From the repo root:

```powershell
py -3.12 -m venv .venv-win
.\.venv-win\Scripts\python.exe -m pip install --upgrade pip
.\.venv-win\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Use `.\.venv-win\Scripts\python.exe` for backend commands on Windows. Plain `python` may point to a global interpreter without the project packages.

## 4. Database Setup

### Fresh Local Database

For a brand-new local database with no tables, create the schema from the current SQLAlchemy models, then mark Alembic as current:

```powershell
@'
import sys
sys.path.insert(0, "backend")
from app.core.database import init_db

init_db()
print("schema_created")
'@ | .\.venv-win\Scripts\python.exe -

.\.venv-win\Scripts\alembic.exe -c backend\alembic.ini stamp head
```

### Existing Local Database

If the database already has tables, run migrations instead:

```powershell
.\.venv-win\Scripts\alembic.exe -c backend\alembic.ini upgrade head
```

Run this after pulling backend model or migration changes.

### Manual Windows PostgreSQL Database

If you are not using Docker and need to create the app database/user manually, connect as the PostgreSQL admin user:

```powershell
psql -U postgres -h localhost
```

Then run:

```sql
create database hotel_management;
create user arcadia with password 'StrongPassword123';
alter database hotel_management owner to arcadia;
\c hotel_management
grant usage, create on schema public to arcadia;
alter schema public owner to arcadia;
```

If a database already exists but migrations fail with `permission denied for schema public`, see `docs/windows-backend-db-setup.md` for the one-time grant repair script.

## 5. Run The Backend

PowerShell:

```powershell
.\.venv-win\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

Open:

- Health: `http://127.0.0.1:8000/health`
- API docs: `http://127.0.0.1:8000/docs`

WSL alternative:

```bash
cd "/mnt/c/Users/Lenovo/Documents/Hotel Managment"
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn app.main:app --app-dir backend --reload --host 0.0.0.0 --port 8000
```

## 6. Frontend Environment

Install dependencies from the repo root:

```powershell
pnpm install
```

Create the dashboard env file if it does not already exist:

```powershell
if (-not (Test-Path apps\dashboard\.env.local)) { Copy-Item apps\dashboard\.env.example apps\dashboard\.env.local }
```

Recommended local values:

```env
NEXT_PUBLIC_API_BASE_URL=/api/v1
API_PROXY_TARGET=http://localhost:8000
NEXT_PUBLIC_WS_BASE_URL=ws://localhost:8000
```

Run the dashboard:

```powershell
pnpm run dev:dashboard
```

Open:

- Dashboard: `http://localhost:3000`
- Hotel login: `http://localhost:3000/login`
- Platform login: `http://localhost:3000/platform/login`

## 7. Seed Demo Data

The normal demo seed creates or reuses hotel slug `arcadia-demo`, resets the demo owner password, and adds sample rooms, staff, guests, reservations, tickets, housekeeping tasks, and analytics data.

Run it directly:

```powershell
.\.venv-win\Scripts\python.exe scripts\seed_demo_data.py
```

Or, with the backend running, call the API endpoint:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/v1/hotels/demo-seed
```

Demo hotel login:

```text
Email: owner@arcadia.demo
Password: DemoPass123!
```

The seed is disabled when `ENVIRONMENT=production`.

## 8. Reset Local DB And Seed Again

Use this only for disposable local development data. It drops the local schema, recreates tables, and seeds the demo hotel:

```powershell
.\.venv-win\Scripts\python.exe scripts\reset_dev_db_and_seed.py --yes
```

This command refuses to run when `ENVIRONMENT=production`.

## 9. Seed Platform Admin

Set platform admin values in `backend\.env`, then run:

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

## 10. Backend Tests

Run the full backend suite:

```powershell
.\.venv-win\Scripts\python.exe -m pytest backend\tests
```

Useful focused runs:

```powershell
.\.venv-win\Scripts\python.exe -m pytest -m unit
.\.venv-win\Scripts\python.exe -m pytest -m integration
.\.venv-win\Scripts\python.exe -m pytest -m rbac
.\.venv-win\Scripts\python.exe -m pytest -m sla
.\.venv-win\Scripts\python.exe -m pytest -m performance
```

The backend pytest suite uses an isolated test SQLite database from `backend\tests\conftest.py`. Do not use a large seeded development database for normal pytest runs.

WSL equivalent:

```bash
cd "/mnt/c/Users/Lenovo/Documents/Hotel Managment"
. .venv/bin/activate
python -m pytest backend/tests
```

## 11. Frontend Checks

The dashboard currently does not define a Jest, Vitest, or Playwright test script in `apps\dashboard\package.json`. Use these as the frontend verification suite:

```powershell
pnpm --filter @arcadia/dashboard lint
pnpm --filter @arcadia/dashboard build
pnpm --filter @arcadia/dashboard typecheck
```

Notes:

- `next build` regenerates `.next/types`.
- If `typecheck` reports missing `.next/types` files, run `pnpm --filter @arcadia/dashboard build` once, then rerun `typecheck`.

## 12. Load And Performance Seed Data

For normal demo testing, use `scripts\seed_demo_data.py`. For performance profiling, use the load seed command.

Small load dataset:

```powershell
.\.venv-win\Scripts\python.exe scripts\seed_load_data.py --size small
```

Dry run:

```powershell
.\.venv-win\Scripts\python.exe scripts\seed_load_data.py --size multi --hotels 100 --dry-run
```

Multi-tenant dataset:

```powershell
.\.venv-win\Scripts\python.exe scripts\seed_load_data.py --size multi --hotel-slug arcadia-load
```

Override counts:

```powershell
.\.venv-win\Scripts\python.exe scripts\seed_load_data.py --size multi --hotels 150 --guests 1500 --tickets 2000
```

Preset sizes:

| Size | Hotels | Rooms | Staff | Guests | Reservations | Tickets |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| small | 1 | 25 | 12 | 100 | 120 | 500 |
| medium | 1 | 100 | 40 | 1,000 | 1,200 | 5,000 |
| large | 1 | 300 | 120 | 20,000 | 25,000 | 100,000 |
| multi | 100 | 50 | 20 | 1,000 | 1,200 | 1,000 |

Counts are per hotel. The JSON summary reports total inserted rows across all generated hotels.

## 13. Recommended Daily Flow

1. Start PostgreSQL and Redis: `docker compose up -d postgres redis`
2. Activate backend env or use `.venv-win` commands.
3. Run migrations: `.\.venv-win\Scripts\alembic.exe -c backend\alembic.ini upgrade head`
4. Start backend: `.\.venv-win\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000`
5. Start dashboard: `pnpm run dev:dashboard`
6. Seed demo data if needed: `.\.venv-win\Scripts\python.exe scripts\seed_demo_data.py`
7. Verify backend: `.\.venv-win\Scripts\python.exe -m pytest backend\tests`
8. Verify frontend: `pnpm --filter @arcadia/dashboard build`
