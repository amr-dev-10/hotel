# Arcadia Design Documents

Architecture documents are versioned by folder so new designs can be added without overwriting earlier decisions.

## Current Implementation Notes

- `../SETUP.md` - canonical single-file setup guide for database setup, backend/frontend environment setup, test commands, demo data seeding, and production notes.
- `development-setup-testing-and-seeding.md` - pointer to the canonical setup guide.
- `GCP_BACKEND_DEPLOYMENT.md` - Google Cloud Run, Cloud SQL, Redis, Secret Manager, and GitHub Actions deployment guide.
- `frontend-cloud-run-deployment.md` - Next.js dashboard deployment to Google Cloud Run with GitHub Actions.
- `release-versioning-and-development-track.md` - SemVer, release candidate, migration, infrastructure, documentation, and current staging deployment fix tracking.
- `staging-serverless-deployment-runbook.md` - staging deployment runbook for `amr-dev-10/hotel`, including Cloud Shell setup, GitHub environment variables, CI/CD trigger steps, verification, and troubleshooting.
- `current-development-operations-guide.md` - current escalation, notification, Food and Beverage, kitchen, and guest portal flows, including staff manual order creation and order editing.
- `ai-chatbot-development-and-testing.md` - AI chatbot MVP implementation map, configuration, Windows dev run commands, automated tests, live smoke test, and troubleshooting.
- `ai-chatbot-conversation-test-cases.md` - manual conversational QA cases for hotel guest messages, expected AI routing/ticket/reply behavior, and Grok/xAI integration notes.
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
