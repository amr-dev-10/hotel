# Escalation, SLA, and Routing Workflow

Last reviewed: 2026-06-22

This document describes how Arcadia currently handles ticket routing, staff acceptance,
SLA timers, and escalation. It is based on the current backend implementation,
dashboard views, automated tests, and a read-only check of the local Postgres data.

## Main Components

- Ticket creation and lifecycle: `backend/app/services/ticket_service.py`
- Dispatch offers and accept/reject handling: `backend/app/services/dispatch_service.py`
- SLA lookup and defaults: `backend/app/services/sla_service.py`
- Routing rule defaults and CRUD: `backend/app/services/routing_service.py`
- Escalation rules and scheduled checks: `backend/app/services/escalation_service.py`
- Worker schedules: `backend/app/workers/celery_app.py`
- Ticket APIs: `backend/app/api/v1/tickets.py`
- Workflow settings UI: `apps/dashboard/src/features/workflow/components/*`
- Escalations UI: `apps/dashboard/src/features/escalations/components/escalations-page.tsx`

## Data Model

### Tickets

Tickets store:

- `department_id`
- `assigned_to`
- `stage`
- `type`
- `task_category`
- `priority`
- `source`
- optional context ids: `guest_id`, `reservation_id`, `conversation_id`, `room_id`
- `sla_due_at`
- `resolved_at`

The API enriches ticket responses with readable labels:

- `assigned_to_name`
- `room_number`
- `guest_name`
- `reservation_no`

### Task SLAs

`task_type_slas` are scoped by hotel, department, and task category.

Each row controls:

- `sla_minutes`: work completion SLA once a ticket is accepted
- `accept_timeout_minutes`: how long a staff member has to accept a dispatch offer

Fallback order:

1. Exact task SLA for hotel + department + task category.
2. Department config SLA, with a 2 minute accept timeout.
3. Hard fallback: 10 minute SLA and 2 minute accept timeout.

Default seeded examples:

- housekeeping `towel_request`: 10 minute SLA, 2 minute accept timeout
- engineering `ac_repair`: 20 minute SLA, 2 minute accept timeout
- front office `general_request`: 15 minute SLA, 2 minute accept timeout
- food and beverage `food_order`: 45 minute SLA, 3 minute accept timeout

### Routing Rules

`routing_rules` are scoped by hotel and exact ticket type.

Default seeded routing rules:

- `complaint` -> admin, priority 1
- `emergency` -> manager, priority 1
- `vip_request` -> manager, priority 1

Routing rules can:

- skip normal assignment
- target a staff level
- target a specific user
- override ticket priority
- configure notification channels

### Escalation Rules

`escalation_rules` are scoped by:

- hotel
- optional department
- optional ticket type
- optional task category
- escalation level

Default seeded escalation path:

- Level 1 -> supervisor
- Level 2 -> manager
- Level 3 -> admin

Rule matching uses specificity scoring:

- department match adds 4
- ticket type match adds 2
- task category match adds 1

The highest score wins for the requested escalation level.

If `trigger_after_minutes` is greater than zero, that value is used. If it is zero,
the effective trigger is:

```text
task_sla_minutes * escalation_level
```

## Ticket Creation Flow

1. `TicketService.create_ticket` validates the ticket context:
   guest, reservation, WhatsApp conversation, room, department, and assigned user.
2. The service resolves the department:
   explicit `department_id`, then `department_key`, then the first active department.
3. The service checks for a routing rule matching `payload.type`.
4. If a routing rule is found and `skip_normal_assignment` is enabled:
   the ticket is fast-tracked to the rule target user or target staff level.
5. If no fast-track target is available:
   assignment falls back to shift availability, available staff, then first on-duty
   staff member for the department.
6. If the ticket workflow supports `pending_accept` and an assignee exists:
   the ticket is created with `assigned_to = null`, `stage = pending_accept`,
   and `sla_due_at = null`.
7. Dispatch then creates one or more `ticket_acceptances` rows and sets
   `ticket.assigned_to` to the first offered user.
8. If acceptance workflow is not available:
   the ticket is directly assigned and `sla_due_at` is set immediately.

## Dispatch and Acceptance Flow

`DispatchService.dispatch_ticket` finds eligible staff using:

1. target staff level from the escalation rule or initial escalation rule
2. ticket department
3. active/not deleted users
4. on-duty preference
5. current open ticket count

It excludes users who already rejected, expired, or currently have a pending offer
for the ticket.

For each eligible staff member, it creates a pending `ticket_acceptances` row and
sends websocket/FCM notifications. The dashboard receives this as a dispatch popup.

When a staff member accepts:

1. The matching pending acceptance becomes `accepted`.
2. Other pending offers for the same ticket become `cancelled`.
3. Ticket `assigned_to` becomes the accepting user.
4. Ticket `stage` becomes `accepted`.
5. Ticket `sla_due_at` becomes `now + task_sla_minutes`.
6. A realtime `ticket.assigned` event is published.

When a staff member rejects:

1. The matching pending acceptance becomes `rejected`.
2. A `rejected` ticket event is recorded.
3. If other pending offers still exist, the ticket waits for them.
4. If no pending offers remain, dispatch escalates to the next escalation level.

## Offer Timeout Flow

Celery beat schedules `tickets.check_pending_acceptances` every minute.

The worker calls `TicketService.expire_pending_acceptances`, which delegates to
`DispatchService.check_expired_offers`.

For each pending acceptance whose age is greater than or equal to
`expire_after_minutes`:

1. The acceptance becomes `expired`.
2. `auto_expired` becomes true.
3. A ticket event `acceptance_expired` is recorded.
4. A user notification is published.
5. If the ticket has no remaining pending offers, it escalates to the next level.

Escalation from timeout uses `DispatchService._escalate_to_next_level`, which:

1. Looks up the next escalation rule.
2. Dispatches the ticket to that rule's target staff level.
3. Creates an `escalation_log` row.
4. Records an `escalated` ticket event.
5. Publishes a realtime `ticket.escalated` event.

## SLA Escalation Flow

Celery beat also schedules `tickets.check_escalations` every minute.

`EscalationService.check_escalations`:

1. Lists all unresolved tickets.
2. Finds the next escalation level from the existing escalation log count.
3. Finds the matching escalation rule.
4. Computes the trigger:
   - explicit `trigger_after_minutes`, or
   - task SLA minutes multiplied by escalation level.
5. Compares the ticket age to the trigger.
6. Fires the rule when the ticket age is greater than or equal to the trigger.
7. Also calls `DispatchService.check_expired_offers`.

Important current behavior: the SLA escalation service currently compares
`now - ticket.created_at`; it does not compare against `ticket.sla_due_at`. That
means a `pending_accept` ticket can be considered by the SLA escalation path if
its age crosses the escalation trigger, even though its work SLA has not started.
The ticket list "SLA breached" filter does use `sla_due_at`, so the UI filter and
worker escalation logic are not identical.

## Escalations Page

The API endpoint is:

```text
GET /api/v1/hotels/{hotel_id}/tickets/escalations
```

It returns two kinds of rows:

1. Real escalation rows from `escalation_log`.
2. Synthetic pending-acceptance rows with:
   - `escalation_id = acceptance:{acceptance_id}`
   - `escalation_level = 0`
   - `reason = pending_acceptance`

This is why a ticket dispatch popup can now also appear on the Escalations page
before a true escalation log exists.

Scope behavior:

- Admin/owner scope defaults to all escalations.
- `scope=all` is only honored for owner, hotel admin, or `staff_level=admin`.
- `scope=department` limits to the current user's department.
- `scope=mine` limits to rows involving the current user.

The dashboard refreshes the escalations query every 15 seconds.

## Test Cases Already Passing

The focused backend workflow tests passed on 2026-06-22:

```text
.\\.venv-win\\Scripts\\python.exe -m pytest backend\\tests\\test_v51_upgrade_features.py backend\\tests\\test_performance_pagination.py -q
4 passed
```

Covered successful cases:

| Area | Test coverage |
| --- | --- |
| Default workflow data | Hotel bootstrap seeds departments, task SLAs, routing rules, escalation rules, and default workflow states. |
| Hierarchy | Manager -> supervisor -> attendant tree is created and returned. |
| Task SLA defaults | Housekeeping `towel_request` returns 10 minute SLA and 2 minute accept timeout. |
| Ticket dispatch | Creating a ticket assigned to an attendant creates a `pending_accept` ticket and pending acceptance row. |
| Staff acceptance | Attendant can accept the ticket; stage becomes `accepted` and `sla_due_at` is set. |
| Completion approval | Assigned staff completes ticket, then owner/admin approves it; stage becomes `approved` and `resolved_at` is set. |
| SLA escalation | An accepted old ticket triggers level 1 escalation to the supervisor. |
| Routing rule fast-track | Complaint ticket is routed with priority override to admin/owner. |
| Rule API visibility | Routing and escalation rule list endpoints return seeded defaults. |
| Ticket labels | Ticket list responses include assigned staff name and room number. |
| Pending acceptance visibility | Pending dispatch rows appear in the Escalations API as `pending_acceptance`. |

## Local DB Read-Only Check

The local Postgres database was checked without modifying data.

Snapshot:

| Metric | Count |
| --- | ---: |
| Hotels | 2 |
| Tickets | 17 |
| Open/unresolved tickets | 15 |
| Pending acceptances | 9 |
| Active escalation rules | 7 |
| Escalation logs | 0 |
| Active task SLAs | 34 |
| Active routing rules | 6 |
| Tickets overdue by `sla_due_at` | 9 |

Hotels found:

- Requirment B
- Arcadia Demo Hotel

Dry-run findings:

- All 15 unresolved tickets currently have a matching level-1 escalation rule and
  would fire if `EscalationService.check_escalations` runs against the local DB.
- All 9 pending acceptances are past their 2 minute timeout.
- There are zero `escalation_log` rows, which strongly suggests the local Celery
  beat/worker sweep has not been running, or the service has not been manually
  triggered against this DB.

Data hygiene note:

- The local DB includes pending acceptance rows attached to at least one approved
  ticket. The current pending-acceptance escalation list does not filter out
  terminal ticket stages, so stale pending acceptances can appear as synthetic
  escalation rows until cleaned up or filtered.

## Recommended Additional Test Cases

These are not fully covered by the current tests and should be added before
calling this workflow production-ready:

| Priority | Test case | Expected result |
| --- | --- | --- |
| High | Expired pending offers are swept by `check_pending_acceptances`. | Pending acceptances become `expired`; next-level dispatch is created; an escalation log is written. |
| High | Rejection by all offered staff. | All offers become `rejected`; ticket escalates to the next configured level. |
| High | Accepted ticket SLA breach uses the intended timer. | Decide whether escalation should use `created_at` or `sla_due_at`; test that exact behavior. |
| High | Terminal tickets with stale pending acceptances. | Approved/completed/cancelled tickets should not appear in Escalations as pending acceptance rows. |
| Medium | Rule specificity. | Department + ticket type + task category rule beats generic rule. |
| Medium | Multi-offer race. | First staff acceptance cancels all other pending offers. |
| Medium | Scope permissions. | Owner/admin sees all; department staff sees department; mine sees only involved rows. |
| Medium | Routing to explicit target user. | Routing rule `target_user_id` assigns/dispatches to that user when active. |
| Medium | No eligible staff. | Ticket remains pending/unassigned with an event, and the UI handles no-offer state cleanly. |
| Low | Notification metadata. | Websocket and notification-center payloads include ticket, acceptance, expiry, and readable labels. |

## Current Risk Summary

The main workflow is implemented and has focused passing tests. The highest-risk
area is scheduled execution and timer semantics:

- Local DB data indicates timeout and escalation workers are probably not running.
- SLA escalation currently uses ticket age from `created_at`, not `sla_due_at`.
- Pending acceptances can remain on terminal tickets and may surface in the
  Escalations page.

Before production, the safest next step is to add the high-priority tests above,
then tighten the worker logic around terminal tickets and the exact SLA timer
definition.
