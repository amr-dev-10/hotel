# Arcadia v5 Final Additions

This folder stores the final v5 architecture additions shared for the Arcadia hotel PMS SaaS backend.

## Source

- `architecture_v5_final.md`
- `backup_dr_plan.md`

## Implemented Backend Scope

- Room availability engine with `room_blocks`.
- Reservation by room type through `reservation_room_types`, with room assignment at check-in.
- Manual/payment-gateway transaction stub table and service.
- Job execution tracking for synchronous worker-style tasks.
- Per-hotel API rate-limit configuration and in-process sliding-window middleware.
- Data export jobs with completed local-memory file URLs.
- Data import jobs with validate-then-execute flow for guest onboarding rows.
- Guest consent records and WhatsApp marketing consent enforcement for campaigns.
- AI provider abstraction with local default plus Gemini/OpenAI/Anthropic provider slots.
- Backup and disaster-recovery plan plus script stub.

## Migration Note

Fresh local test databases are auto-created. Existing PostgreSQL deployments need an Alembic migration for v5 tables, new columns, and the production GiST exclusion constraint for overlapping `room_blocks`.
