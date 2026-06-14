# Arcadia Architecture V2

This folder stores the second shared design baseline for backend development.

Included source document:

- `arcadia_architecture_v2.md` - enterprise multi-tenant Arcadia architecture with dynamic RBAC, reservation/PMS workflows, per-hotel WhatsApp accounts, FAQ knowledge base, bot versioning, service forms, audit logs, media tracking, billing, and notification center.

Implementation status:

- V2 source design preserved in this folder.
- Dynamic RBAC tables, services, permission seeding, and protected endpoints added.
- Reservation and stay-record PMS workflows added.
- Per-hotel WhatsApp accounts, templates, conversation history, and message logs added.
- FAQ knowledge base, bot versions, hotel languages, department configs, and dynamic service forms added.
- Audit logs, notification center, media tracking, subscription, and invoice tables/endpoints added.
- Stripe, S3/R2, Deepgram, and ElevenLabs integration stubs added.
- Existing WhatsApp onboarding now creates reservations/stay records and checks FAQ before AI fallback.
