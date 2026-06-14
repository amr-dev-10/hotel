# Arcadia Architecture V1

This folder stores the first shared design baseline for backend development.

Included source documents:

- `my_architecture_design_v1.md` - modular monolith, PostgreSQL-first platform architecture.
- `whatsapp_guest_flows_v1.md` - WhatsApp guest onboarding, ticket, and campaign flows.

Implementation status:

- FastAPI modular monolith structure added.
- SQLAlchemy models added for the v1 database tables.
- Hotel-scoped repositories and JWT access guard added.
- REST routes added under `/api/v1`.
- WhatsApp webhook and state-machine service added.
- Campaign, notification, WebSocket, and worker entry points added.
