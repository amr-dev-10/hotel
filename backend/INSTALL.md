# Arcadia Backend Setup

The backend has been rebuilt from the versioned architecture documents in `docs/`, currently through v5.
Dependencies and local tooling are pinned so development can continue from a stable base.

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

Edit `backend\.env` and set real values for `JWT_SECRET`, `ENCRYPTION_KEY` or `VAULT_MASTER_KEY`, WhatsApp, Gemini, and Firebase when those integrations are ready. Set `WHATSAPP_APP_SECRET` to enable HMAC verification for incoming Meta webhook POST requests.

## Start PostgreSQL And Redis

With Docker installed:

```powershell
docker compose up -d postgres redis
```

Or create a local PostgreSQL 16 database named `arcadia` and run Redis 7 on port `6379`.

## Run Migrations

The Alembic environment imports SQLAlchemy model metadata from `app.models`.

```powershell
alembic -c backend\alembic.ini revision --autogenerate -m "arcadia v1 schema"
alembic -c backend\alembic.ini upgrade head
```

## Run The API

```powershell
uvicorn app.main:app --app-dir backend --reload --host 0.0.0.0 --port 8000
```

Open:

- `http://localhost:8000/health`
- `http://localhost:8000/docs`

## Main Routes

- `GET /health`
- `POST /api/v1/hotels/bootstrap`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/logout-all`
- `GET /api/v1/auth/me`
- `/api/v1/orgs`
- `/api/v1/hotels/{hotel_id}/users`
- `/api/v1/hotels/{hotel_id}/roles`
- `/api/v1/hotels/{hotel_id}/users/{user_id}/roles`
- `/api/v1/hotels/{hotel_id}/room-types`
- `/api/v1/hotels/{hotel_id}/rooms`
- `/api/v1/hotels/{hotel_id}/departments`
- `/api/v1/hotels/{hotel_id}/guests`
- `/api/v1/hotels/{hotel_id}/reservations`
- `/api/v1/hotels/{hotel_id}/reservations/{reservation_id}`
- `/api/v1/hotels/{hotel_id}/reservations/{reservation_id}/checkin`
- `/api/v1/hotels/{hotel_id}/reservations/{reservation_id}/checkout`
- `/api/v1/hotels/{hotel_id}/reservations/{reservation_id}/change-room`
- `/api/v1/hotels/{hotel_id}/reservations/{reservation_id}/guests`
- `/api/v1/hotels/{hotel_id}/reservations/{reservation_id}/room-types`
- `/api/v1/hotels/{hotel_id}/reservations/{reservation_id}/stays`
- `/api/v1/hotels/{hotel_id}/availability/blocks`
- `/api/v1/hotels/{hotel_id}/availability/rooms`
- `/api/v1/hotels/{hotel_id}/availability/calendar`
- `/api/v1/hotels/{hotel_id}/rate-plans`
- `/api/v1/hotels/{hotel_id}/folios`
- `/api/v1/hotels/{hotel_id}/tax-configs`
- `/api/v1/hotels/{hotel_id}/tickets`
- `/api/v1/hotels/{hotel_id}/housekeeping`
- `/api/v1/hotels/{hotel_id}/maintenance`
- `/api/v1/hotels/{hotel_id}/lost-found`
- `/api/v1/hotels/{hotel_id}/inventory/vendors`
- `/api/v1/hotels/{hotel_id}/inventory/items`
- `/api/v1/hotels/{hotel_id}/inventory/transactions`
- `/api/v1/hotels/{hotel_id}/inventory/purchase-orders`
- `/api/v1/hotels/{hotel_id}/restaurant/tables`
- `/api/v1/hotels/{hotel_id}/restaurant/orders`
- `/api/v1/hotels/{hotel_id}/shifts`
- `/api/v1/hotels/{hotel_id}/workflows`
- `/api/v1/hotels/{hotel_id}/saas/features`
- `/api/v1/hotels/{hotel_id}/saas/plan-features`
- `/api/v1/hotels/{hotel_id}/saas/usage-limits`
- `/api/v1/hotels/{hotel_id}/exports`
- `/api/v1/hotels/{hotel_id}/imports`
- `/api/v1/hotels/{hotel_id}/jobs`
- `/api/v1/hotels/{hotel_id}/rate-limits`
- `/api/v1/hotels/{hotel_id}/menu/categories`
- `/api/v1/hotels/{hotel_id}/menu/items`
- `/api/v1/hotels/{hotel_id}/bot-config`
- `/api/v1/hotels/{hotel_id}/campaigns`
- `/api/v1/hotels/{hotel_id}/feedback`
- `/api/v1/hotels/{hotel_id}/whatsapp/accounts`
- `/api/v1/hotels/{hotel_id}/whatsapp/account`
- `/api/v1/hotels/{hotel_id}/whatsapp/templates`
- `/api/v1/hotels/{hotel_id}/whatsapp/templates/sync`
- `/api/v1/hotels/{hotel_id}/whatsapp/onboarding/start`
- `/api/v1/hotels/{hotel_id}/whatsapp/conversations`
- `/api/v1/hotels/{hotel_id}/whatsapp/conversation-windows`
- `/api/v1/hotels/{hotel_id}/whatsapp/health`
- `/api/v1/hotels/{hotel_id}/whatsapp/usage`
- `/api/v1/hotels/{hotel_id}/live-chat/sessions`
- `/api/v1/hotels/{hotel_id}/faqs`
- `/api/v1/hotels/{hotel_id}/knowledge/faqs`
- `/api/v1/hotels/{hotel_id}/bot-config/versions`
- `/api/v1/hotels/{hotel_id}/bot-config/rollback`
- `/api/v1/hotels/{hotel_id}/knowledge/bot-versions`
- `/api/v1/hotels/{hotel_id}/knowledge/languages`
- `/api/v1/hotels/{hotel_id}/knowledge/department-configs`
- `/api/v1/hotels/{hotel_id}/knowledge/service-forms`
- `/api/v1/hotels/{hotel_id}/knowledge/{document_id}/versions`
- `/api/v1/hotels/{hotel_id}/knowledge/{document_id}/rollback`
- `/api/v1/hotels/{hotel_id}/service-forms`
- `/api/v1/hotels/{hotel_id}/audit-logs`
- `/api/v1/hotels/{hotel_id}/notifications`
- `/api/v1/hotels/{hotel_id}/notifications/me`
- `/api/v1/hotels/{hotel_id}/media`
- `/api/v1/hotels/{hotel_id}/media/upload`
- `/api/v1/hotels/{hotel_id}/billing/subscription`
- `/api/v1/hotels/{hotel_id}/billing/invoices`
- `/api/v1/hotels/{hotel_id}/subscription`
- `/api/v1/hotels/{hotel_id}/invoices`
- `/api/v1/hotels/{hotel_id}/analytics`
- `GET /webhook/whatsapp`
- `POST /webhook/whatsapp`
- `/ws/tickets`
- `/ws/chat`
- `/ws/notifications`
- `/ws/{hotel_id}/tickets`
- `/ws/{hotel_id}/chat/{ticket_id}`
