# Arcadia Backend Setup

Codex only added code and setup files. It did not install Python packages, start Docker, or modify your local environment.

## Library Versions

Install Python packages from `backend/requirements.txt`.

| Purpose | Package | Version |
|---|---|---|
| API framework | `fastapi` | `0.116.1` |
| ASGI server | `uvicorn[standard]` | `0.35.0` |
| ORM | `SQLAlchemy` | `2.0.41` |
| Migrations | `alembic` | `1.16.2` |
| Validation/settings | `pydantic`, `pydantic-settings` | `2.11.7`, `2.10.1` |
| JWT auth | `PyJWT`, `python-jose[cryptography]` | `2.10.1`, `3.3.0` |
| Password hashing | `passlib[argon2]` | `1.7.4` |
| PostgreSQL driver | `psycopg[binary]` | `3.2.9` |
| Redis/session/pub-sub | `redis`, `broadcaster` | `6.2.0`, `0.3.1` |
| Background jobs | `celery` | `5.5.3` |
| Logging | `structlog` | `25.4.0` |
| Forms/uploads | `python-multipart` | `0.0.20` |
| Email validation | `email-validator` | `2.2.0` |
| HTTP client | `httpx` | `0.28.1` |
| Push notifications | `firebase-admin` | `6.5.0` |
| Gemini SDK | `google-generativeai` | `0.8.5` |
| Tests | `pytest` | `8.4.1` |

System services:

| Service | Version |
|---|---|
| Python | `3.11+` |
| PostgreSQL | `16` |
| Redis | `7` |

## Windows PowerShell Install Steps

From `C:\Users\Lenovo\Documents\Hotel Managment`:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
```

Edit `backend\.env` and set real values for `JWT_SECRET`, WhatsApp, Gemini, and Firebase when those integrations are ready. Set `WHATSAPP_APP_SECRET` to enable HMAC verification for incoming Meta webhook POST requests.

## Start PostgreSQL And Redis

With Docker installed:

```powershell
docker compose up -d postgres redis
```

Or create a local PostgreSQL 16 database named `arcadia` and run Redis 7 on port `6379`.

## Run Migrations

```powershell
alembic -c backend\alembic.ini revision --autogenerate -m "initial arcadia schema"
alembic -c backend\alembic.ini upgrade head
```

## Run The API

```powershell
uvicorn app.main:app --app-dir backend --reload --host 0.0.0.0 --port 8000
```

Open:

- `http://localhost:8000/health`
- `http://localhost:8000/docs`

## Main Routes Created

- Auth: `/api/v1/auth/login`, `/api/v1/auth/refresh`, `/api/v1/auth/logout`, `/api/v1/auth/guest/verify-phone`, `/api/v1/auth/guest/confirm-otp`
- Hotels: `/api/v1/hotels`, `/api/v1/hotels/{hotel_id}`, `/api/v1/hotels/{hotel_id}/stats`
- Staff: `/api/v1/hotels/{hotel_id}/users`
- Rooms: `/api/v1/hotels/{hotel_id}/rooms`
- Departments: `/api/v1/hotels/{hotel_id}/departments`
- Tickets: `/api/v1/hotels/{hotel_id}/tickets`
- Ticket messages: `/api/v1/hotels/{hotel_id}/tickets/{ticket_id}/messages`
- Menu: `/api/v1/hotels/{hotel_id}/menu/categories`, `/api/v1/hotels/{hotel_id}/menu/items`
- Guests: `/api/v1/hotels/{hotel_id}/guests`
- Feedback: `/api/v1/hotels/{hotel_id}/feedback`
- Bot config: `/api/v1/hotels/{hotel_id}/bot-config`
- Campaigns: `/api/v1/hotels/{hotel_id}/campaigns`
- WhatsApp webhook: `/webhook/whatsapp`
- Voice webhook: `/webhook/voice/inbound`
- WebSockets: `/ws/hotels/{hotel_id}/tickets`, `/ws/hotels/{hotel_id}/chat/{ticket_id}`, `/ws/voice`
