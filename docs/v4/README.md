# Arcadia v4 Definitive Architecture

This folder stores the definitive v4 architecture design shared for the Arcadia hotel PMS SaaS backend.

## Source

- `architecture_v4_definitive.md`

## Implemented Backend Scope

- Multi-guest reservations through `reservation_guests`.
- Inventory vendors, items, stock transactions, purchase orders, and PO receiving.
- Housekeeping checklist-driven inventory deduction when tasks are completed.
- Restaurant/POS tables, orders, order items, room-service folio posting, and food-order ticket creation.
- Shift scheduling with checked-in shift-aware ticket assignment and ticket-load balancing.
- Dynamic ticket workflows with states, transitions, permissions, and terminal resolution.
- PostgreSQL tenant context hook for RLS policies through `app.current_hotel_id`.
- Expanded soft-delete coverage for menu entities, alongside hotels, users, rooms, room types, guests, reservations, tickets, and departments.
- Knowledge document version snapshots, rollback, processing status, and embedding worker entry point.
- WhatsApp onboarding, test message flow, and Meta conversation-window tracking.
- SaaS features, plan features, and monthly usage limits.

## Migration Note

Fresh local test databases are auto-created. Existing PostgreSQL deployments need an Alembic migration for the v4 tables and new columns before upgrade.
