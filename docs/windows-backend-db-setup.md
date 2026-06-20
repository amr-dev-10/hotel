# Windows Backend And Database Setup

This setup runs the FastAPI backend on Windows with `.venv-win`, uses Windows PostgreSQL as the app database, and keeps Redis reachable at `localhost:6379` from WSL.

## Expected Local Services

- Backend Python: `C:\Users\Lenovo\Documents\Hotel Managment\.venv-win`
- PostgreSQL: Windows service on `localhost:5432`
- Redis: WSL Redis, reachable from Windows at `localhost:6379`
- API: `http://127.0.0.1:8000`

## What Was Wrong In This Setup

The Windows backend dependencies were installed correctly in `.venv-win`, and Windows PostgreSQL was reachable. The problem was the database state:

- `backend\.env` pointed to `hotel_management` as user `arcadia`.
- The `hotel_management` database existed but had `0` tables.
- The `arcadia` database user could connect but did not have permission to create tables in schema `public`.
- Plain `python` was the global Windows Python, not `.venv-win`, so backend commands must use `.\.venv-win\Scripts\python.exe`.

## Backend Environment

Use `backend\.env` for the Windows backend:

```env
APP_NAME="Hotel Cloud Platform"
DATABASE_URL="postgresql+psycopg://arcadia:StrongPassword123@localhost:5432/hotel_management"
ENVIRONMENT="development"
JWT_SECRET="change-this-development-secret-minimum-32-chars"
JWT_ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=720
REDIS_URL="redis://localhost:6379/0"

PLATFORM_ADMIN_NAME="Arcadia Admin"
PLATFORM_ADMIN_EMAIL="admin@arcadia.io"
PLATFORM_ADMIN_PASSWORD="ArcadiaAdmin123!"
```

Alembic imports `backend\.env` through `backend\alembic\env.py`, so migrations and the app must point at the same `DATABASE_URL`.

## Fix PostgreSQL Permissions

If Alembic or app startup fails with `permission denied for schema public`, the database user can connect but cannot create tables. Run this once from the repo root:

```powershell
@'
import psycopg

conn = psycopg.connect(
    "postgresql://postgres:postgres@localhost:5432/hotel_management",
    autocommit=True,
)
with conn.cursor() as cur:
    cur.execute("alter database hotel_management owner to arcadia")
    cur.execute("grant all privileges on database hotel_management to arcadia")
    cur.execute("grant usage, create on schema public to arcadia")
    cur.execute("alter schema public owner to arcadia")
    cur.execute("grant all privileges on all tables in schema public to arcadia")
    cur.execute("grant all privileges on all sequences in schema public to arcadia")
conn.close()
print("privileges_fixed")
'@ | .\.venv-win\Scripts\python.exe -
```

## Initialize A Fresh Windows Database

For a fresh empty `hotel_management` database:

```powershell
@'
import sys
sys.path.insert(0, "backend")
from app.core.database import init_db

init_db()
print("schema_created")
'@ | .\.venv-win\Scripts\python.exe -

.\.venv-win\Scripts\alembic.exe -c backend\alembic.ini stamp head
.\.venv-win\Scripts\python.exe scripts\seed_demo_data.py

$env:PYTHONPATH = "backend"
$env:PLATFORM_ADMIN_NAME = "Arcadia Admin"
$env:PLATFORM_ADMIN_EMAIL = "admin@arcadia.io"
$env:PLATFORM_ADMIN_PASSWORD = "ArcadiaAdmin123!"
.\.venv-win\Scripts\python.exe backend\app\seeds\seed_platform_admin.py
```

The demo hotel login is:

- Email: `owner@arcadia.demo`
- Password: `DemoPass123!`

The platform admin login is:

- Email: `admin@arcadia.io`
- Password: value of `PLATFORM_ADMIN_PASSWORD`

## Verify Database And Redis

```powershell
@'
import sys
sys.path.insert(0, "backend")
from sqlalchemy import text
from app.core.database import SessionLocal

with SessionLocal() as db:
    row = db.execute(text("""
        select
          (select count(*) from hotels) as hotels,
          (select count(*) from users) as users,
          (select count(*) from rooms) as rooms,
          (select count(*) from platform_admins) as platform_admins,
          (select version_num from alembic_version limit 1) as alembic_version
    """)).mappings().one()
    print(dict(row))
'@ | .\.venv-win\Scripts\python.exe -

@'
import socket
with socket.create_connection(("localhost", 6379), timeout=3) as sock:
    sock.sendall(b"*1\r\n$4\r\nPING\r\n")
    print(sock.recv(1024).decode().strip())
'@ | .\.venv-win\Scripts\python.exe -
```

Expected Redis output is `+PONG`.

## Run Backend On Windows

From the repo root:

```powershell
.\.venv-win\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Open:

- `http://127.0.0.1:8000/health`
- `http://127.0.0.1:8000/docs`

## Known Pitfall

Do not run backend commands with plain `python` unless that interpreter is `.venv-win`. On this machine, plain `python` is the global Windows Python and does not have the backend libraries installed. Use:

```powershell
.\.venv-win\Scripts\python.exe
```
