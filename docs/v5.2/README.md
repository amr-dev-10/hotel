# Arcadia Architecture v5.2

v5.2 adds account security and platform operations controls on top of v5.1, plus the reservation soft-cancellation workflow described in the provided cancellation reference.

Implemented scope:

- Hotel users can change their own password from profile settings.
- Platform admins can change their own platform password.
- Platform admins can edit hotel user profile fields across tenants.
- Platform admins can update tenant subscription plan, status, billing cycle, and renewal date.
- Reservations can be soft-cancelled with cancellation timestamp, actor, reason, availability release, and audit logging.

Source design:

- `architecture_v5_2_account_platform_cancellation.md`

Operational notes:

- Existing databases need Alembic revision `20260616_01_reservation_cancellation` for reservation cancellation metadata.
- Password changes revoke existing hotel refresh sessions for that user.
- Platform user edits are audited with a platform-admin source payload and no hotel-user foreign key.
