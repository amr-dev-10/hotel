# Arcadia v3 Final Architecture

This folder stores the final v3 architecture design shared for the Arcadia hotel PMS SaaS backend.

## Source

- `architecture_v3_final.md`

## Implemented Backend Scope

- Guest identity decoupled from rooms; current occupancy is derived from `stay_records`.
- Room inventory expanded with `room_types` and room-to-type assignment.
- Guest folios, folio items, payments, refunds, and tax configs.
- Rate plans and seasonal/weekday rate periods.
- JWT-secured topic WebSockets at `/ws/tickets`, `/ws/chat`, and `/ws/notifications`.
- Permission groups and expanded RBAC permissions.
- WhatsApp health, usage, persisted conversations, and live-chat handoff.
- Knowledge documents with chunk storage and local RAG-style lookup before AI fallback.
- Refresh-token sessions and encrypted hotel secrets vault.
- Multi-hotel organizations and organization analytics.
- Analytics snapshots.
- Housekeeping, maintenance, and lost-and-found PMS modules.
- Worker entry points for nightly charges, analytics snapshots, WhatsApp health, and housekeeping reconciliation.
