# Testing And Load Strategy

Last updated: 2026-06-23

This guide explains how to use the current Arcadia testing foundation.

## Test Layers

| Layer | Purpose | Command |
| --- | --- | --- |
| Unit | Fast logic checks with no large dataset. | `python -m pytest -m unit` |
| Integration | API/database flows using the isolated test DB. | `python -m pytest -m integration` |
| RBAC | Role, permission, and access-scope behavior. | `python -m pytest -m rbac` |
| SLA | Time-based escalation and overdue-ticket behavior. | `python -m pytest -m sla` |
| Performance checks | Pagination/index behavior in normal pytest. | `python -m pytest -m performance` |
| Load tests | Locust traffic against a running local/staging server. | `locust -f backend/tests/performance/locustfile.py` |

## Normal Test Suite

Run all backend tests:

```powershell
.\.venv-win\Scripts\python.exe -m pytest backend\tests -q
```

The test suite uses a separate temporary SQLite database configured in `backend/tests/conftest.py`.

Do not run normal pytest against a large seeded development database.

## Fast Auth Headers For RBAC Tests

`backend/tests/conftest.py` provides `auth_headers_for_user`.

Use it when a test already has a `User` row and does not need to test the login flow itself. This avoids repeated password hashing and login requests in focused RBAC tests.

## Large Seed Data

Use the seed command only for local performance work or staging-like testing. Arcadia is multi-tenant, so the seed command supports both single-hotel and multi-hotel datasets.

From the repo root:

```powershell
.\.venv-win\Scripts\python.exe scripts\seed_load_data.py --size small
```

From the `backend` directory:

```powershell
..\.venv-win\Scripts\python.exe -m app.seeds.run --size small
```

Preset sizes. The room, staff, guest, reservation, and ticket counts are per hotel:

| Size | Hotels | Rooms | Staff | Guests | Reservations | Tickets |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| small | 1 | 25 | 12 | 100 | 120 | 500 |
| medium | 1 | 100 | 40 | 1,000 | 1,200 | 5,000 |
| large | 1 | 300 | 120 | 20,000 | 25,000 | 100,000 |
| multi | 100 | 50 | 20 | 1,000 | 1,200 | 1,000 |

For multi-tenant profiling with 100 hotels and 1,000+ related rows per hotel:

```powershell
.\.venv-win\Scripts\python.exe scripts\seed_load_data.py --size multi --hotel-slug arcadia-load
```

For a heavier tenant-isolation check with 200 hotels:

```powershell
.\.venv-win\Scripts\python.exe scripts\seed_load_data.py --size multi --hotels 200 --hotel-slug arcadia-load
```

When `--hotels` is greater than `1`, the command creates hotel slugs by suffixing the base slug:

```text
arcadia-load-001
arcadia-load-002
arcadia-load-003
```

Override any count:

```powershell
.\.venv-win\Scripts\python.exe scripts\seed_load_data.py --size multi --hotels 150 --guests 1500 --tickets 2000
```

Preview without inserting load rows:

```powershell
.\.venv-win\Scripts\python.exe scripts\seed_load_data.py --size multi --hotels 100 --dry-run
```

Safety:

- The seed command refuses to run when `ENVIRONMENT=production`.
- It appends generated rows to the target hotel or tenant hotel set.
- A dry run reports the planned tenant slugs and counts without inserting hotels or load rows.
- Large data is for local/staging performance checks, not for normal pytest.
- In the JSON summary, `plan` is per hotel and `inserted` is the total across all generated hotels.

## Locust Load Test

Start the backend server, then run:

```powershell
locust -f backend/tests/performance/locustfile.py --host http://localhost:8000
```

Set credentials and hotel ID:

```powershell
$env:ARCADIA_HOTEL_ID="your-hotel-id"
$env:ARCADIA_LOAD_EMAIL="owner@arcadia.demo"
$env:ARCADIA_LOAD_PASSWORD="DemoPass123!"
locust -f backend/tests/performance/locustfile.py --host http://localhost:8000
```

The Locust script exercises:

- Ticket list
- Guest list
- Reservation list
- Escalation list

## Recommended Rollout Order

1. Keep all current backend tests green.
2. Use `python -m app.seeds.run --size medium` for local performance profiling.
3. Use `python -m pytest -m rbac` before changing access rules.
4. Use `python -m pytest -m sla` before changing escalation/SLA logic.
5. Run Locust only after the API and RBAC suites are stable.
