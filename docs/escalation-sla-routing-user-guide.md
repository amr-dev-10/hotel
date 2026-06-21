# Escalation, SLA, and Routing User Guide

Last updated: 2026-06-22

This guide explains how hotel teams should use and configure ticket routing,
SLAs, categories, and escalation rules in Arcadia.

## What The Workflow Does

Arcadia creates tickets from several places:

- WhatsApp chatbot requests
- WhatsApp staff inbox right panel
- Guest portal service requests
- Dashboard tickets created by staff
- Room service or food order flows

Every ticket should have a category, department, priority, assignee/dispatch
offer, and SLA due time. Escalation uses those values to decide when a ticket
should move to a senior staff member.

## Simple Functional Flow

1. A guest or staff member creates a ticket.
2. Arcadia assigns a category such as Guest Request, Towel Request, Maintenance,
   Room Service, or Complaint.
3. The category tells Arcadia which department owns the ticket and which SLA time
   applies.
4. Arcadia dispatches the ticket to available staff.
5. Staff must accept the ticket within the accept timeout.
6. If nobody accepts in time, Arcadia escalates the ticket to the next configured
   staff level.
7. When staff accepts, the work SLA starts.
8. If the ticket passes its due time, Arcadia escalates it to the senior level
   configured in the escalation rule.
9. The Escalations page shows pending dispatches and tickets that have escalated.

## When Escalation Will Trigger

Use this section as the plain-language checklist for when Arcadia will move a
ticket to a senior person or show it in the escalation workflow.

### 1. No Staff Member Accepts The Ticket In Time

This happens after Arcadia dispatches a ticket to staff.

The timer used here is the category or SLA field called **Accept min**.

Example:

- A guest asks for towels.
- Arcadia offers the ticket to housekeeping staff.
- The accept timeout is 2 minutes.
- If no staff member accepts within 2 minutes, Arcadia escalates the ticket to
  the next configured level, usually Supervisor.

Important notes:

- If one staff member accepts before the timeout, this escalation does not
  happen.
- If the ticket was offered to more than one staff member, Arcadia waits for the
  pending offers to finish. If nobody accepts, it escalates.
- A notification popup can appear as soon as a ticket is dispatched. That popup
  means action is needed. It does not always mean the ticket has already failed
  its SLA.

### 2. All Offered Staff Reject The Ticket

This happens when staff members reject the dispatch offer.

Example:

- Arcadia offers a maintenance ticket to available maintenance staff.
- Every offered staff member rejects it.
- Arcadia escalates the ticket to the next configured level so the issue is not
  stuck without an owner.

Important notes:

- If some staff offers are still pending, Arcadia waits for those responses.
- If one staff member accepts, the ticket becomes assigned and the work SLA
  starts.

### 3. An Accepted Ticket Passes Its Due Time

This is the main SLA escalation case.

The timer used here is the ticket due time. The due time is normally calculated
from the category SLA after a staff member accepts the ticket.

Example:

- A plumbing ticket is accepted at 10:00.
- The category SLA is 30 minutes.
- The ticket is due at 10:30.
- If it is still not resolved after 10:30, Arcadia escalates it according to the
  active escalation rule.

Important notes:

- Level 1 usually forwards to Supervisor.
- Level 2 can forward to Manager after extra minutes.
- Level 3 can forward to Admin after more extra minutes.
- If the assigned staff member has a reporting manager in the hierarchy,
  Arcadia tries to forward the escalation through that reporting line first.

### 4. A Previous Escalation Is Still Not Handled

Escalation can continue to the next level if the ticket remains unresolved.

Example:

- Level 1 sends the ticket to Supervisor at the due time.
- The rule says Level 2 starts 10 minutes after due time.
- If the ticket is still unresolved, Arcadia escalates it to Manager.
- If the ticket is still unresolved after the next configured delay, Arcadia can
  escalate it to Admin.

This is controlled by the escalation rule field called **Minutes after due**.

### 5. A Reopened Ticket Becomes Active Again

If a resolved ticket is reopened, it becomes active work again.

Example:

- A guest says the room issue is still not fixed.
- Staff reopens the ticket.
- If the reopened ticket receives an active due time and passes that due time,
  Arcadia can escalate it again using the matching escalation rules.

### 6. Tickets From Any Source Can Escalate

The source does not block escalation. A ticket can escalate when it comes from:

- WhatsApp chatbot
- WhatsApp right panel
- Guest portal
- Dashboard manual ticket form
- Room service or food order flow
- Maintenance, housekeeping, F&B, kitchen, or other department workflows

The important values are category, department, priority, assignee or dispatch
offer, due time, and active escalation rules.

### 7. Manual Routing Is Not The Same As Escalation

Some routing rules can send a ticket directly to a manager, supervisor, admin,
or department queue.

That is routing, not always escalation.

Example:

- A complaint may route directly to a manager because it is high priority.
- The ticket can still escalate later if nobody accepts it or if it passes its
  due time.

### 8. Escalation Will Not Trigger In These Cases

Arcadia should not escalate when:

- The ticket is already resolved, completed, cancelled, closed, or approved.
- A staff member accepted the dispatch before the accept timeout.
- The accepted ticket has not reached its due time yet.
- No active escalation rule matches the ticket department, category, priority,
  and level.
- The ticket has no category or SLA due time configured.
- The background worker or scheduler is not running.

### Timer Cheat Sheet

| Timer | Starts When | Used For |
| --- | --- | --- |
| Accept min | Ticket is offered to staff | Escalates when nobody accepts in time |
| SLA minutes | Staff accepts the ticket | Sets the ticket due time |
| Minutes after due | Ticket passes due time | Sends unresolved tickets to higher levels |

## The Three Main Cases

### 1. WhatsApp Chatbot Ticket

When the chatbot creates a ticket, Arcadia now maps the selected service to a
real ticket category.

Examples:

- Extra Towels -> Towel Request
- Drinking Water -> Drinking Water
- AC Not Working -> AC Repair
- Plumbing Issue -> Plumbing
- Taxi/Cab -> Taxi Booking

Result:

- The ticket enters the normal dispatch flow.
- It appears as pending acceptance on the Escalations page.
- If the staff member does not accept in time, it escalates.
- If accepted but not completed before the due time, it escalates by SLA.

### 2. Guest Portal Ticket

When a guest uses the guest portal request form, they select a service category.

Result:

- The category sets the department and SLA.
- The ticket enters dispatch.
- It appears on the Escalations page while pending acceptance.
- It escalates on timeout or after due time.

### 3. Ticket Exceeds Due Time

After a ticket is accepted, Arcadia sets the due time from the category SLA.

If the ticket passes that due time:

- Level 1 sends it to the configured senior level, usually Supervisor.
- Level 2 can send it to Manager after extra minutes.
- Level 3 can send it to Admin after more extra minutes.

For assigned staff with a reporting line, the system first tries to forward the
ticket to the senior person in that reporting chain.

## Configuration Screens

Go to:

```text
Settings -> Workflow
```

You will see:

- Escalations
- SLAs
- Routing

## Ticket Categories

Ticket categories are the approved service types used by tickets. The UI should
use categories instead of typing a free-text category.

Examples:

- Guest Request
- Complaint
- Towel Request
- Housekeeping
- Maintenance
- AC Repair
- Plumbing
- Room Service
- Food Order

Each category controls:

- Department
- Default priority
- SLA minutes
- Accept timeout minutes

## Task SLA Fields

Screen:

```text
Settings -> Workflow -> SLAs
```

Available operations:

- Add SLA: create a new time rule for a category in the selected department.
- Edit SLA: load an existing SLA into the form, change the values, then save.
- Delete SLA: remove the SLA from the active list. This makes it inactive, so
  new tickets stop using it.

Fields:

| Field | Purpose |
| --- | --- |
| Department | Selects the team whose SLA list you are managing. Only categories owned by that department are shown. |
| Task category | The service category this SLA applies to, such as Towel Request, AC Repair, Food Order, or Complaint. |
| SLA minutes | The work completion time after staff accepts the ticket. If this time passes and the ticket is still unresolved, escalation can trigger. |
| Accept min | The dispatch acceptance time. If nobody accepts the ticket offer within this time, Arcadia can escalate it before work starts. |
| Description | Plain-language note that tells staff what this SLA is for. It does not change the timer logic. |

Example:

```text
Department: Housekeeping
Task category: Towel Request
SLA minutes: 10
Accept min: 2
```

Meaning:

Housekeeping staff must accept the towel request within 2 minutes. After they
accept it, they should complete it within 10 minutes.

When editing an SLA, use the same fields. For example, changing `SLA minutes`
from 10 to 15 gives staff 15 minutes after acceptance for future matching
tickets. Deleting an SLA does not delete old tickets. It only stops that SLA
from being used as an active rule.

## Escalation Rule Fields

Screen:

```text
Settings -> Workflow -> Escalations
```

Available operations:

- Add rule
- Edit rule
- Delete rule
- Reset defaults

Fields:

| Field | Purpose |
| --- | --- |
| Department | Optional. Use this when the rule applies only to one department. |
| Ticket type | Optional. Use this for ticket types like Ticket, Complaint, or Food Order. |
| Task category | Optional. Use this for a specific service category like Towel Request. |
| Level | Escalation step. Level 1 usually goes to Supervisor, Level 2 to Manager, Level 3 to Admin. |
| Minutes after due | Extra minutes after the SLA due time before this rule fires. Use 0 for immediate escalation at due time. |
| Target level | Who should receive the escalation: Supervisor, Manager, or Admin. |

Example:

```text
Department: Housekeeping
Task category: Towel Request
Level: 1
Minutes after due: 0
Target level: Supervisor
```

Meaning:

If a towel request is not completed by its due time, Arcadia escalates it to the
housekeeping supervisor.

## Reset Defaults

Use Reset defaults when you want Arcadia to replace the active escalation rules
with common hotel rules.

Default rule pattern:

| Level | When | Target |
| --- | --- | --- |
| 1 | At SLA due time | Supervisor |
| 2 | 10 minutes after due time | Manager |
| 3 | 20 minutes after due time | Admin |

Default category-specific rules are also added for common cases:

- Guest Request
- Complaint
- Towel Request
- Housekeeping
- Maintenance
- AC Repair
- Room Service
- Food Order

## Routing Rule Fields

Screen:

```text
Settings -> Workflow -> Routing
```

Routing rules are used before SLA escalation. They decide whether a ticket should
skip normal assignment and go directly to a higher staff level.

Available operations:

- Add rule: create a new routing rule for a ticket type.
- Edit rule: load an existing routing rule into the form, change it, then save.
- Delete rule: remove the routing rule from the active list. New tickets stop
  using it.

Fields:

| Field | Purpose |
| --- | --- |
| Ticket type | The ticket type that should be routed specially, such as Complaint, Emergency, VIP Request, or Food Order. |
| Target level | The staff level that should receive the ticket: Supervisor, Manager, or Admin. |
| Priority | Optional priority override for tickets matching this rule. In the current dashboard, P1 is low and P5 is critical. |
| Assignment | Decides whether the ticket skips normal attendant assignment or still follows normal assignment. Use skip normal assignment for complaints and emergencies. |
| Notify | Decides whether Arcadia sends a notification immediately when the rule matches. |
| Channels | The notification channels used when Notify is enabled: mobile push, in-app, and WhatsApp. |

Example:

```text
Ticket type: complaint
Target level: admin
Priority: 5
Assignment: Skip normal assignment
Notify: Notify immediately
Channels: Mobile push, In-app, WhatsApp
```

Meaning:

Complaint tickets skip the normal attendant dispatch and route to the configured
admin/owner level immediately. They are marked critical in the ticket UI and
the selected notification channels are used right away.

When editing a routing rule, be careful with `Assignment`. If it is set to
`Use normal assignment`, the ticket can still go through the usual department
assignment flow. If it is set to `Skip normal assignment`, Arcadia fast-tracks
the ticket to the selected target level.

## Escalations Page

Screen:

```text
Operations -> Escalations
```

This page shows:

- Pending accept tickets that have been dispatched and are waiting for staff
- Tickets escalated by accept timeout
- Tickets escalated after SLA due time

Filters:

| Filter | Meaning |
| --- | --- |
| All escalations | Admin/owner view across the hotel. |
| Department | Tickets visible to your department. |
| Mine | Tickets assigned or escalated to/from you. |

## Operational Tips

- Always choose a ticket category when creating a ticket.
- Keep category SLA minutes realistic for the department.
- Use 0 minutes after due for first-level escalation.
- Use Reset defaults if rules become confusing during setup.
- Make sure staff hierarchy is configured, because escalation tries to send work
  to the senior person for the assigned staff member.
- Make sure background workers are running in production; otherwise timeout and
  SLA checks will not execute automatically.
