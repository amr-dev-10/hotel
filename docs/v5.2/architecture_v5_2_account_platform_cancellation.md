# Arcadia v5.2 Account, Platform, and Cancellation Design

## Goals

v5.2 closes three operational gaps:

- Users need a profile-level password change flow without administrator help.
- Platform admins need direct controls for tenant users and subscriptions.
- Reservations need a soft-cancel workflow that preserves booking history and releases availability.

## Backend Contracts

Account security:

- `POST /api/v1/auth/change-password`
- `POST /api/v1/platform/auth/change-password`

Both endpoints require the current password, a new password, and confirmation. Hotel-user password changes revoke active refresh sessions after the password hash changes.

Platform operations:

- `PATCH /api/v1/platform/users/{user_id}`
- `PATCH /api/v1/platform/subscriptions/{subscription_id}`

Platform user updates reuse the hotel user validation rules for email uniqueness, manager references, and last-admin protection. Subscription updates mutate the subscription row and mirror plan changes to `hotels.subscription_tier`.

Reservation cancellation:

- `POST /api/v1/hotels/{hotel_id}/reservations/{reservation_id}/cancel`

The endpoint requires `reservation.cancel`, accepts an optional `reason`, and rejects already-cancelled or checked-in/out reservations. It sets `status = cancelled`, `cancelled_at`, `cancelled_by`, and `cancellation_reason`, releases availability holds, and writes an audit log.

## Data Model

`reservations` gains:

- `cancelled_at`
- `cancelled_by`
- `cancellation_reason`

The reservation row remains the source of truth. No separate cancellation table is introduced.

## Frontend Scope

Hotel dashboard:

- Profile settings now include a password change form.
- Reservation list and detail pages expose a cancel action for booked or confirmed reservations.
- Cancel confirmation captures a reason and removes check-in/check-out actions after cancellation.

Platform dashboard:

- Platform settings include super-admin password change.
- `/platform/users` lists all hotel users and opens an edit dialog.
- `/platform/subscriptions` lists tenant subscriptions and opens an update dialog.
- Platform navigation includes Users and Subscriptions.

## Audit and Safety

- Hotel password changes validate the current password and revoke refresh sessions.
- Platform user edits use a platform audit payload while leaving `audit_logs.user_id` null.
- Subscription changes are audited against the target hotel.
- Reservation cancellations keep the reservation record intact and avoid hard deletes.
