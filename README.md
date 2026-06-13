# Arcadia Hotel Platform Backend

FastAPI backend for a multi-tenant hotel management platform using PostgreSQL, Redis-backed real-time flows, JWT auth, Android-ready REST APIs, and WebSockets.

The current backend lives in `backend/` and implements the Arcadia migration plan:

- Hotels, staff, rooms, departments, guests, menu, feedback, bot config, and ticketing APIs.
- Staff JWT login, refresh/logout, and guest phone OTP token flow.
- WhatsApp and voice webhook entry points.
- Ticket/chat/voice WebSocket endpoints.
- PostgreSQL 16 and Redis 7 Docker Compose services.
- Alembic migration scaffold.

Codex did not install packages. See [backend/INSTALL.md](backend/INSTALL.md) for pinned library versions and installation steps.

## Quick Setup

```bash
cd /mnt/c/Users/Lenovo/Documents/Hotel\ Managment
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
docker compose up -d postgres redis
uvicorn app.main:app --app-dir backend --reload --host 0.0.0.0 --port 8000
```

Open:

- API health: `http://localhost:8000/health`
- API docs/testing UI: `http://localhost:8000/docs`

## Database

Default config expects PostgreSQL:

```text
postgresql+psycopg://postgres:postgres@localhost:5432/arcadia
```

For quick local smoke tests without PostgreSQL, set:

```text
DATABASE_URL=sqlite:///./hotel_cloud_dev.db
```

## Main API Groups

- `/api/v1/auth`
- `/api/v1/hotels`
- `/api/v1/hotels/{hotel_id}/users`
- `/api/v1/hotels/{hotel_id}/rooms`
- `/api/v1/hotels/{hotel_id}/departments`
- `/api/v1/hotels/{hotel_id}/tickets`
- `/api/v1/hotels/{hotel_id}/menu`
- `/api/v1/hotels/{hotel_id}/guests`
- `/api/v1/hotels/{hotel_id}/feedback`
- `/api/v1/hotels/{hotel_id}/bot-config`
- `/webhook/whatsapp`
- `/webhook/voice/inbound`
- `/ws/hotels/{hotel_id}/tickets`
- `/ws/hotels/{hotel_id}/chat/{ticket_id}`
- `/ws/voice`
