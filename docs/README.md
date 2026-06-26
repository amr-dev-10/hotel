# Arcadia Design Documents

Architecture documents are versioned by folder so new designs can be added without overwriting earlier decisions.

## Current Implementation Notes

- `../SETUP.md` - canonical single-file setup guide for database setup, backend/frontend environment setup, test commands, demo data seeding, and production notes.
- `development-setup-testing-and-seeding.md` - pointer to the canonical setup guide.
- `current-development-operations-guide.md` - current escalation, notification, Food and Beverage, kitchen, and guest portal flows, including staff manual order creation and order editing.
- `order-computation-functional-flow.md` - Food and Beverage POS order total calculation flow, current backend behavior, and recommended charge/discount extension model.

## Versions

- `v1/` - initial Arcadia backend architecture and WhatsApp guest flow design.
- `v2/` - enterprise extension with RBAC, PMS reservations, WhatsApp accounts, knowledge base, audit logs, media, and billing.
- `v2.1/` - extended v2 implementation notes with endpoint completeness, dynamic service forms, bot rollback, richer audit/media/notification fields, and seeded system roles.
- `v3/` - final PMS SaaS architecture with room types, stay-record room history, folios/payments, rate plans, JWT-secured WebSockets, permission groups, WhatsApp health/usage/live chat, RAG knowledge documents, refresh sessions, secrets vault, organizations, analytics snapshots, housekeeping, maintenance, and lost-and-found.
- `v4/` - definitive backend expansion with multi-guest reservations, inventory and purchase orders, restaurant/POS room-service folio posting, employee shifts, dynamic workflows, PostgreSQL RLS tenant context, knowledge document versions, WhatsApp onboarding/conversation windows, feature flags, and usage limits.
- `v5/` - final additions for room availability and blocks, booking by room type, payment transaction stubs, job execution tracking, API rate limits, import/export jobs, guest consent enforcement, AI provider abstraction, and backup/DR planning.
- `v5.1/` - operational hierarchy upgrade with staff reporting chains, ticket acceptance flow, task-type SLAs, escalation rules/logs, complaint fast-track routing, and AI settings management APIs.
- `v5.2/` - account security and platform operations upgrade with profile password changes, platform user profile edits, platform subscription updates, and reservation soft cancellation.

When a new design version is shared, add it as a new folder such as `v6/` and keep the earlier versions intact for comparison.
