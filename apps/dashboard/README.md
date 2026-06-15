# Arcadia Dashboard

Next.js dashboard for the Arcadia hotel PMS/SaaS platform.

## Setup

From the workspace root:

```bash
pnpm install
pnpm dev:dashboard
```

The dashboard runs at `http://localhost:3000`.

Backend defaults to:

```text
http://localhost:8000/api/v1
```

Override it with:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1 pnpm dev:dashboard
```

## Backend Pairing

Start the FastAPI backend first:

```bash
cd /mnt/c/Users/Lenovo/Documents/Hotel\ Managment
. .venv/bin/activate
uvicorn app.main:app --app-dir backend --reload --host 0.0.0.0 --port 8000
```

Seed demo data:

```bash
python scripts/seed_demo_data.py
```

Demo login:

```text
Email: owner@arcadia.demo
Password: DemoPass123!
```

Super Admin login:

```text
URL: http://localhost:3000/platform/login
Email: admin@arcadia.io
Password: ArcadiaAdmin123!
```

The normal `/login` page is only for hotel users. Super Admins authenticate through `/platform/auth/login`, so use `/platform/login` in the frontend.

## App Structure

```text
src/app
  (auth)/login              hotel login
  (dashboard)/[hotelId]     hotel-scoped dashboard routes

src/features
  analytics                 overview metrics
  auth                      login form and schema
  housekeeping              housekeeping planner
  reservations              reservation views/forms
  roles                     RBAC role and permission matrix
  staff                     staff directory/profile
  tickets                   board/detail/actions
  whatsapp                  inbox/settings/templates
  workflow                  SLA/routing/escalation settings

src/lib/api
  client.ts                 Axios instance and response unwrap helpers
  query-keys.ts             TanStack Query cache keys

src/stores
  auth.store.ts             persisted hotel auth token/user state
```

## API Contract

All backend calls expect the shared envelope:

```ts
interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown> | null;
}
```

Use the helpers in `src/lib/api/client.ts`:

```ts
apiGet<T>("/hotels/{hotelId}/rooms")
apiPost<T>("/hotels/{hotelId}/tickets", payload)
apiPut<T>("/hotels/{hotelId}/roles/{roleId}", payload)
apiPatch<T>("/hotels/{hotelId}/users/{userId}", payload)
apiDelete<T>("/hotels/{hotelId}/roles/{roleId}")
```

These helpers return `response.data.data`, not the whole envelope.

## Auth Logic

Hotel auth is stored in localStorage under:

```text
arcadia-auth-storage
```

`api` automatically reads `state.token` from that store and sends:

```text
Authorization: Bearer <hotel-token>
```

Hotel routes require a hotel-scoped token and a matching `[hotelId]` route param. Platform/Super Admin routes use a separate backend token scope and should use a separate client/store when platform UI is added.

Platform auth is stored separately under:

```text
arcadia-platform-auth-storage
```

The platform client calls `/platform/*` endpoints and sends only the platform token.

## RBAC Logic

The backend now returns role permission assignments:

```ts
interface Role {
  id: string;
  hotel_id: string;
  name: string;
  permissions?: Permission[];
}
```

The role editor reads `role.permissions` to preselect the permission matrix. Saving roles sends `permission_codes` to the backend.

Important backend endpoints:

```text
GET /hotels/{hotelId}/roles
GET /hotels/{hotelId}/roles/permissions
GET /hotels/{hotelId}/roles/permissions/all
PUT /hotels/{hotelId}/roles/{roleId}/permissions
```

## Debugging Checklist

1. Check backend health: `http://localhost:8000/health`.
2. Check API docs: `http://localhost:8000/docs`.
3. Confirm `NEXT_PUBLIC_API_BASE_URL` includes `/api/v1`.
4. In browser devtools, inspect failed requests and confirm the response shape has `data`.
5. If every hotel route returns `403`, confirm the URL hotel ID matches the token hotel ID.
6. If role permissions are empty, call `GET /hotels/{hotelId}/roles/permissions/all` once to seed/read the permission registry.
7. If local DB errors mention missing columns, run Alembic migrations or reset the local dev DB.

## Useful Commands

```bash
pnpm --filter @arcadia/dashboard dev
pnpm --filter @arcadia/dashboard typecheck
pnpm --filter @arcadia/dashboard lint
pnpm --filter @arcadia/dashboard build
```

## Common Failure Points

`401` means no token or an expired token.

`403` usually means a hotel/platform token scope mismatch, wrong hotel ID, or missing RBAC permission.

`404` on a page-level API usually means the frontend route was built before the backend endpoint existed.

Empty UI with successful network calls usually means the component expects an array but the backend returned a different envelope or nested shape.
