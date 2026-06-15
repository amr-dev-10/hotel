# Arcadia Hotel Platform Backend

FastAPI backend for the Arcadia hotel management platform, currently upgraded through the v5.2 platform/RBAC architecture.

The backend follows the v5.1 principles:

- Modular monolith first.
- PostgreSQL as the production source of truth.
- `hotel_id` scoping on tenant data.
- REST as the data API and WebSockets as the live update layer.
- WhatsApp, Gemini, FCM, Redis, and Celery behind integration boundaries.
- Config-driven WhatsApp bot flows stored in the database.
- Dynamic hotel-defined RBAC with permission-enforced routes.
- User type separation for platform admins, hotel admins, and hotel employees.
- Reservation/PMS records separate from guest profile records.
- Per-hotel WhatsApp accounts and persisted conversation history.
- FAQ knowledge base before AI fallback.
- Audit logs, notification center, media tracking, and billing tables.
- Seeded system roles and expanded permission map.
- Bot config version snapshots and rollback.
- Dynamic service-form collection inside WhatsApp conversations.
- Campaign send/stat endpoints and richer delivery counters.
- Room types and stay records as the source of truth for room history.
- Guest folios, folio items, payments, refunds, tax configs, and rate plans.
- Refresh-token sessions and encrypted hotel secrets vault.
- JWT-secured topic WebSockets at `/ws/tickets`, `/ws/chat`, and `/ws/notifications`.
- WhatsApp health monitoring, monthly usage tracking, and live-chat handoff.
- Knowledge documents with chunk search before AI fallback.
- Multi-hotel organizations, analytics snapshots, housekeeping, maintenance, and lost-and-found.
- Multi-guest reservations with primary/secondary guest links.
- Inventory vendors, items, transactions, purchase orders, and housekeeping stock deduction.
- Restaurant/POS tables and orders with room-service folio posting and food-order tickets.
- Employee shifts and shift-aware ticket assignment by active load.
- Dynamic workflow states and transitions for ticket stages.
- PostgreSQL RLS tenant context through `app.current_hotel_id`.
- Knowledge document versions, rollback, and embedding processing status.
- WhatsApp onboarding, test messages, and conversation-window billing rows.
- SaaS features, plan features, and monthly usage limits.
- Room availability blocks prevent double booking and support maintenance/VIP holds.
- Reservations can be booked by room type and assigned to actual rooms at check-in.
- Payment gateway transactions are stubbed for later Razorpay/Stripe/UPI integration.
- Import/export jobs, job execution tracking, API rate limits, consent enforcement, and AI provider abstraction are implemented.
- Staff reporting hierarchy, ticket accept/reject flow, task-type SLAs, escalation rules/logs, fast-track routing, and hotel AI settings APIs are implemented.
- Platform Super Admin APIs for dashboard metrics, hotels, users, subscriptions, and global settings.

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

## Frontend + Backend Demo Login

Start the backend in WSL, then seed a local demo hotel:

```bash
cd /mnt/c/Users/Lenovo/Documents/Hotel\ Managment
. .venv/bin/activate
python scripts/seed_demo_data.py
```

Or, after restarting the backend with the latest code:

```bash
curl -X POST http://localhost:8000/api/v1/hotels/demo-seed
```

If your local PostgreSQL database was created from an older code version and demo seeding fails with missing-column errors, reset the local development schema and seed in one step:

```bash
cd /mnt/c/Users/Lenovo/Documents/Hotel\ Managment
. .venv/bin/activate
python scripts/reset_dev_db_and_seed.py --yes
```

That reset command is destructive and should only be used for local development data.

Use these credentials in the dashboard at `http://localhost:3000/login`:

- Email: `owner@arcadia.demo`
- Password: `DemoPass123!`

The demo seed creates/reuses hotel slug `arcadia-demo`, resets the demo owner password, and inserts sample rooms, staff, guests, reservations, tickets, housekeeping tasks, and analytics snapshots. The endpoint is disabled when `ENVIRONMENT=production`.

## Super Admin Bootstrap

Create the first platform admin:

```bash
cd /mnt/c/Users/Lenovo/Documents/Hotel\ Managment
. .venv/bin/activate
PYTHONPATH=backend PLATFORM_ADMIN_PASSWORD=SecurePass123! python -m app.seeds.seed_platform_admin
```

Then log in through:

```text
POST /api/v1/platform/auth/login
```

## Current API

- `GET /health`
- `POST /api/v1/hotels/bootstrap`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/logout-all`
- `/api/v1/orgs`
- `/api/v1/hotels/{hotel_id}/users`
- `/api/v1/hotels/{hotel_id}/roles`
- `GET /api/v1/hotels/{hotel_id}/roles/permissions/all`
- `PUT /api/v1/hotels/{hotel_id}/roles/{role_id}/permissions`
- `/api/v1/hotels/{hotel_id}/users/{user_id}/roles`
- `GET /api/v1/platform/dashboard`
- `GET /api/v1/platform/hotels`
- `POST /api/v1/platform/hotels`
- `GET /api/v1/platform/users`
- `GET /api/v1/platform/subscriptions`
- `GET /api/v1/platform/platform-settings`
- `/api/v1/hotels/{hotel_id}/room-types`
- `/api/v1/hotels/{hotel_id}/rooms`
- `/api/v1/hotels/{hotel_id}/departments`
- `/api/v1/hotels/{hotel_id}/departments/{department_id}/hierarchy`
- `/api/v1/hotels/{hotel_id}/departments/{department_id}/task-slas`
- `/api/v1/hotels/{hotel_id}/guests`
- `/api/v1/hotels/{hotel_id}/reservations`
- `/api/v1/hotels/{hotel_id}/reservations/{reservation_id}/guests`
- `/api/v1/hotels/{hotel_id}/reservations/{reservation_id}/room-types`
- `/api/v1/hotels/{hotel_id}/availability`
- `/api/v1/hotels/{hotel_id}/reservations/{reservation_id}/change-room`
- `/api/v1/hotels/{hotel_id}/reservations/{reservation_id}/stays`
- `/api/v1/hotels/{hotel_id}/rate-plans`
- `/api/v1/hotels/{hotel_id}/folios`
- `/api/v1/hotels/{hotel_id}/tax-configs`
- `/api/v1/hotels/{hotel_id}/tickets`
- `/api/v1/hotels/{hotel_id}/tickets/{ticket_id}/accept`
- `/api/v1/hotels/{hotel_id}/tickets/{ticket_id}/reject`
- `/api/v1/hotels/{hotel_id}/tickets/{ticket_id}/complete`
- `/api/v1/hotels/{hotel_id}/tickets/{ticket_id}/approve`
- `/api/v1/hotels/{hotel_id}/tickets/{ticket_id}/reopen`
- `/api/v1/hotels/{hotel_id}/tickets/{ticket_id}/acceptances`
- `/api/v1/hotels/{hotel_id}/tickets/{ticket_id}/escalations`
- `/api/v1/hotels/{hotel_id}/escalation-rules`
- `/api/v1/hotels/{hotel_id}/routing-rules`
- `/api/v1/hotels/{hotel_id}/housekeeping`
- `/api/v1/hotels/{hotel_id}/maintenance`
- `/api/v1/hotels/{hotel_id}/lost-found`
- `/api/v1/hotels/{hotel_id}/inventory`
- `/api/v1/hotels/{hotel_id}/restaurant`
- `/api/v1/hotels/{hotel_id}/shifts`
- `/api/v1/hotels/{hotel_id}/workflows`
- `/api/v1/hotels/{hotel_id}/saas`
- `/api/v1/hotels/{hotel_id}/exports`
- `/api/v1/hotels/{hotel_id}/imports`
- `/api/v1/hotels/{hotel_id}/jobs`
- `/api/v1/hotels/{hotel_id}/rate-limits`
- `/api/v1/hotels/{hotel_id}/settings/ai`
- `/api/v1/hotels/{hotel_id}/menu`
- `/api/v1/hotels/{hotel_id}/bot-config`
- `/api/v1/hotels/{hotel_id}/campaigns`
- `/api/v1/hotels/{hotel_id}/feedback`
- `/api/v1/hotels/{hotel_id}/whatsapp`
- `/api/v1/hotels/{hotel_id}/whatsapp/health`
- `/api/v1/hotels/{hotel_id}/whatsapp/usage`
- `/api/v1/hotels/{hotel_id}/whatsapp/onboarding/start`
- `/api/v1/hotels/{hotel_id}/whatsapp/conversation-windows`
- `/api/v1/hotels/{hotel_id}/live-chat`
- `/api/v1/hotels/{hotel_id}/faqs`
- `/api/v1/hotels/{hotel_id}/service-forms`
- `/api/v1/hotels/{hotel_id}/knowledge`
- `/api/v1/hotels/{hotel_id}/knowledge/{document_id}/versions`
- `/api/v1/hotels/{hotel_id}/audit-logs`
- `/api/v1/hotels/{hotel_id}/notifications`
- `/api/v1/hotels/{hotel_id}/media`
- `/api/v1/hotels/{hotel_id}/billing`
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

## Design Docs

The shared v1 files are preserved in:

- `docs/v1/my_architecture_design_v1.md`
- `docs/v1/whatsapp_guest_flows_v1.md`
- `docs/v2/arcadia_architecture_v2.md`
- `docs/v2.1/architecture_v2_extended.md`
- `docs/v3/architecture_v3_final.md`
- `docs/v4/architecture_v4_definitive.md`
- `docs/v5/architecture_v5_final.md`
- `docs/v5/backup_dr_plan.md`
- `docs/v5.1/architecture_v5_1_upgrade.md`

## Migration Note

Fresh development and test databases can be auto-created. Existing databases should run Alembic before starting the upgraded app:

```bash
alembic upgrade head
```

Production should also add the PostgreSQL GiST exclusion constraint for overlapping `room_blocks`.
