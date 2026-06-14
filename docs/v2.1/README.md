# Arcadia Architecture V2.1

This folder stores the extended v2 design provided as the next development layer after `docs/v2/`.

Included source document:

- `architecture_v2_extended.md` - extended production SaaS design with the complete endpoint table, seeded system roles, bot rollback, dynamic service-form collection, richer campaign/media/notification/audit fields, and phase-by-phase build order.

Implementation status:

- Source design preserved in this folder.
- Expanded permission map and seeded system roles: Owner, Manager, Receptionist, Staff.
- Role update/delete and `/users/{user_id}/roles` assignment endpoint added.
- Reservation detail/update plus `checkin` and `checkout` aliases added.
- WhatsApp singular account config, update, encrypted-token field, and template sync endpoint added.
- Bot config version listing and rollback endpoint added.
- FAQ update/delete and flatter `/faqs` and `/service-forms` aliases added.
- Dynamic service-form collection added to the WhatsApp bot state machine.
- Campaign send trigger and delivery stats endpoint added.
- Notification read-state endpoints added.
- Media upload alias and delete endpoint added.
- Subscription upgrade and invoice aliases added.
- V2.1 smoke test added for extended behavior.
