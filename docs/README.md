# Arcadia Design Documents

Architecture documents are versioned by folder so new designs can be added without overwriting earlier decisions.

## Versions

- `v1/` - initial Arcadia backend architecture and WhatsApp guest flow design.
- `v2/` - enterprise extension with RBAC, PMS reservations, WhatsApp accounts, knowledge base, audit logs, media, and billing.
- `v2.1/` - extended v2 implementation notes with endpoint completeness, dynamic service forms, bot rollback, richer audit/media/notification fields, and seeded system roles.
- `v3/` - final PMS SaaS architecture with room types, stay-record room history, folios/payments, rate plans, JWT-secured WebSockets, permission groups, WhatsApp health/usage/live chat, RAG knowledge documents, refresh sessions, secrets vault, organizations, analytics snapshots, housekeeping, maintenance, and lost-and-found.
- `v4/` - definitive backend expansion with multi-guest reservations, inventory and purchase orders, restaurant/POS room-service folio posting, employee shifts, dynamic workflows, PostgreSQL RLS tenant context, knowledge document versions, WhatsApp onboarding/conversation windows, feature flags, and usage limits.
- `v5/` - final additions for room availability and blocks, booking by room type, payment transaction stubs, job execution tracking, API rate limits, import/export jobs, guest consent enforcement, AI provider abstraction, and backup/DR planning.

When a new design version is shared, add it as a new folder such as `v6/` and keep the earlier versions intact for comparison.
