# Arcadia Architecture v5.1

v5.1 upgrades the v5 backend with the operational hierarchy and ticket lifecycle required for real hotel task handling.

Implemented backend scope:

- Staff hierarchy through `users.reports_to` and `users.staff_level`.
- Department hierarchy tree endpoint for manager, supervisor, and attendant display.
- Ticket acceptance offers with accept, reject, and auto-expire support.
- Task-type SLAs with per-category completion deadlines and acceptance timeouts.
- Default ticket workflow with created, pending accept, accepted, in progress, pending approval, approved, reopened, and cancelled states.
- Escalation rules and escalation logs with worker-backed SLA sweeps.
- Complaint, emergency, and VIP fast-track routing rules.
- Hotel-level AI provider settings API backed by the existing encrypted secrets vault.

Source design:

- `architecture_v5_1_upgrade.md`

Operational notes:

- Fresh development databases can auto-create these tables.
- Existing PostgreSQL databases need an Alembic migration for the new v5.1 tables and columns.
- Celery deployments should register `tickets.check_pending_acceptances` and `tickets.check_escalations` as periodic tasks.
