# Arcadia Hotel Platform Backend

FastAPI backend for the Arcadia hotel management platform, rebuilt from the v1 architecture shared in `docs/v1/`.

The backend follows the v1 principles:

- Modular monolith first.
- PostgreSQL as the production source of truth.
- `hotel_id` scoping on tenant data.
- REST as the data API and WebSockets as the live update layer.
- WhatsApp, Gemini, FCM, Redis, and Celery behind integration boundaries.
- Config-driven WhatsApp bot flows stored in the database.

## Quick Setup

```bash
cd /mnt/c/Users/Lenovo/Documents/Hotel\ Managment
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn app.main:app --app-dir backend --reload --host 0.0.0.0 --port 8000
```

Open:

- API health: `http://localhost:8000/health`
- API docs/testing UI: `http://localhost:8000/docs`

## Current API

- `GET /health`
- `POST /api/v1/hotels/bootstrap`
- `POST /api/v1/auth/login`
- `/api/v1/hotels/{hotel_id}/users`
- `/api/v1/hotels/{hotel_id}/rooms`
- `/api/v1/hotels/{hotel_id}/departments`
- `/api/v1/hotels/{hotel_id}/guests`
- `/api/v1/hotels/{hotel_id}/tickets`
- `/api/v1/hotels/{hotel_id}/menu`
- `/api/v1/hotels/{hotel_id}/bot-config`
- `/api/v1/hotels/{hotel_id}/campaigns`
- `/api/v1/hotels/{hotel_id}/feedback`
- `GET /webhook/whatsapp`
- `POST /webhook/whatsapp`
- `/ws/{hotel_id}/tickets`
- `/ws/{hotel_id}/chat/{ticket_id}`

## Design Docs

The shared v1 files are preserved in:

- `docs/v1/my_architecture_design_v1.md`
- `docs/v1/whatsapp_guest_flows_v1.md`
