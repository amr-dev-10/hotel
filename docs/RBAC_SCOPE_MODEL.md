# RBAC Scope Model

For the full nontechnical access and action manual, see [rbac-access-action-user-manual.md](rbac-access-action-user-manual.md).

Arcadia now treats access as three separate ideas:

1. Resource: the thing being accessed, such as ticket, staff, shift, room, or reservation.
2. Action: what the user can do, such as view, create, update, delete, assign, approve, or manage.
3. Scope: how much data that permission covers.

This replaces confusing permission names such as `ticket.view_own` in the role editor. Those old names still work for existing roles, but new configuration should use the base permission plus scope.

## Scope Meanings

| Scope | Meaning | Example |
| --- | --- | --- |
| Own | User can access only records assigned to them or belonging to them. | A staff member sees only their own tickets or shifts. |
| Department | User can access records for their department. | A housekeeping supervisor sees housekeeping tickets and staff. |
| Hotel | User can access records across the hotel. | A manager sees all hotel tickets and staff. |

## Recommended Role Setup

### Staff

- `ticket.view` with scope `Own`
- `ticket.accept`
- `ticket.reject`
- `ticket.complete_own`
- `shift.view` with scope `Own`
- `shift.update` with scope `Own`

### Department Supervisor

- `ticket.view` with scope `Department`
- `ticket.assign`
- `ticket.accept`
- `ticket.reject`
- `ticket.approve`
- `staff.view` with scope `Department`
- `shift.view` with scope `Department`
- `shift.update` with scope `Department`

### Manager

- `ticket.view` with scope `Hotel`
- `ticket.assign`
- `ticket.approve`
- `ticket.verify`
- `staff.view` with scope `Hotel`
- `staff.update` with scope `Hotel`
- `reservation.view`
- `room.view`
- `analytics.view`

## UI Field Guide

| Field | Purpose |
| --- | --- |
| Role name | The business name shown to admins, for example Staff, Supervisor, or Manager. |
| Description | A short note explaining who should receive the role. |
| Permission checkbox | Enables the action, such as viewing tickets or updating shifts. |
| Scope selector | Limits scoped permissions to Own, Department, or Hotel. It appears only where row-level scope is enforced. |

## Permission Rules

Use baseline CRUD names where possible:

- `view`: read screens and lists.
- `create`: add a new record.
- `update`: edit an existing record.
- `delete`: remove a record.
- `manage`: full administrative access for that resource.

Keep workflow actions explicit because they mean more than simple editing:

- `ticket.assign`
- `ticket.accept`
- `ticket.reject`
- `ticket.approve`
- `ticket.verify`
- `ticket.close`
- `campaign.send`
- `bot.publish`

## Current Compatibility

Existing role rows using old scoped permissions are converted at read time:

| Old permission | New display |
| --- | --- |
| `ticket.view_own` | `ticket.view` with scope `Own` |
| `ticket.view_dept` | `ticket.view` with scope `Department` |
| `ticket.view_all` | `ticket.view` with scope `Hotel` |
| `shift.view_own` | `shift.view` with scope `Own` |
| `shift.view_dept` | `shift.view` with scope `Department` |
| `shift.update_own` | `shift.update` with scope `Own` |
| `user.view` | `staff.view` |
| `user.update` | `staff.update` |

Admins should use the new names when editing roles. Saving a role writes the canonical permission and scope back to the database.

## Triggered Access Behavior

- Ticket list and ticket detail use `ticket.view` scope.
- Staff list and staff profile use `staff.view` scope.
- Staff edit uses `staff.update` scope.
- Shift list uses `shift.view` scope, and also allows visibility needed by `shift.update`.
- Shift edit uses `shift.update` scope.
- `manage` permissions imply the lower actions for that resource, but lower actions never imply `manage`.
