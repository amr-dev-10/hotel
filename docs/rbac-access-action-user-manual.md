# RBAC Access And Action User Manual

Last updated: 2026-06-23

This document explains how Arcadia role access works in human terms. It is written for hotel owners, managers, and admins who configure staff roles from the dashboard.

## What RBAC Means

RBAC means Role-Based Access Control.

Instead of giving access directly to every staff user one by one, you create roles such as:

- Owner
- Manager
- Receptionist
- Housekeeping Supervisor
- Housekeeping Staff
- Engineering Staff
- F&B Staff

Then you assign one or more roles to a staff member.

Each role contains permissions. A permission answers two questions:

1. What can this person do?
2. How much data can this person see or change?

## Three Parts Of Access

Arcadia access has three parts.

| Part | Meaning | Example |
| --- | --- | --- |
| Resource | The business area or record type. | Ticket, Staff, Shift, Room, Reservation |
| Action | The operation the user can perform. | View, Create, Update, Delete, Assign, Approve |
| Scope | The data range the permission applies to. | Own, Department, Hotel |

Example:

`ticket.view` with scope `Department` means:

The user can view tickets, but only tickets in their own department.

## Where To Configure Roles

Open:

Settings -> Roles

Use this section to:

- Create a new role.
- Edit an existing role.
- Choose permissions for that role.
- Choose scope for scoped permissions.
- Save the role.
- Assign that role to staff from the Staff area.

## Role Editor Fields

| Field | What It Does | Guidance |
| --- | --- | --- |
| Role name | Name shown to admins and staff setup screens. | Use a clear business name, such as Housekeeping Supervisor. |
| Description | Explains who should receive the role. | Keep it short and operational. |
| Permission checkbox | Turns a specific access/action ON or OFF. | Checked means the role grants that action. Unchecked means it does not. |
| Scope selector | Limits the data range for scoped permissions. | Use Own for staff, Department for supervisors, Hotel for managers. |
| Save role | Stores the selected permissions and scopes. | Existing users with this role get updated access after refresh/live auth update. |

## What Happens When You Turn A Permission ON

When a checkbox is ON:

- The role grants that action.
- Any user assigned to the role receives that access.
- The dashboard may show related navigation items, buttons, lists, or detail pages.
- The backend API allows the action if the user also matches the required scope.

Example:

If `ticket.create` is ON, the user can create tickets from allowed ticket entry points.

## What Happens When You Turn A Permission OFF

When a checkbox is OFF:

- The role does not grant that action.
- Related menu items or action buttons may disappear.
- If the user manually opens a blocked page or action, the backend returns an access denied response.
- The user may still have the action if another assigned role grants it.

Example:

If `role.manage` is OFF, the user cannot create, edit, or delete roles unless another role grants `role.manage`.

## Scope Options

Some permissions have a scope selector. The current scoped permissions are:

- Ticket view
- Staff view
- Staff update
- Shift view
- Shift update

| Scope | Meaning | Typical User |
| --- | --- | --- |
| Own | Only records assigned to the user or owned by the user. | Attendant, technician, individual staff |
| Department | Records in the user's department. | Supervisor, department head |
| Hotel | Records across the whole hotel. | Manager, owner, admin |

## Scope Examples

### Ticket View

| Selection | Result |
| --- | --- |
| `ticket.view` + Own | User sees tickets assigned to them or followed by them. |
| `ticket.view` + Department | User sees tickets in their department. |
| `ticket.view` + Hotel | User sees all hotel tickets. |

### Staff View

| Selection | Result |
| --- | --- |
| `staff.view` + Own | User sees only their own staff profile. |
| `staff.view` + Department | User sees staff in their department. |
| `staff.view` + Hotel | User sees all hotel staff. |

### Shift Update

| Selection | Result |
| --- | --- |
| `shift.update` + Own | User can update only their own shift status. |
| `shift.update` + Department | User can update shifts for their department. |
| `shift.update` + Hotel | User can update shifts across the hotel. |

## Multiple Roles

A user can have more than one role.

When a user has multiple roles:

- Permissions are combined.
- If any role grants an action, the user gets that action.
- For scoped permissions, the broadest scope wins.

Scope order from smallest to largest:

Own -> Department -> Hotel

Example:

If one role gives `ticket.view` with Own and another role gives `ticket.view` with Department, the user gets Department ticket visibility.

## Owner Access

The hotel owner has full access.

Owner access is intentionally broad because the owner must be able to recover configuration, manage roles, and access all hotel areas.

## Manage Permissions

Permissions ending in `.manage` are administrative permissions.

Manage means full control for that resource or area. In the backend, `manage` can satisfy lower actions for the same resource, but lower actions never satisfy `manage`.

Example:

- `shift.manage` can allow shift viewing and shift administration.
- `shift.update` does not allow `shift.manage`.

Use `manage` only for trusted admin or manager roles.

## Permission Reference By Module

The following sections explain each visible permission and what it means in the product.

## Tickets

Tickets are guest or hotel operation requests, usually from WhatsApp, the guest portal, or staff.

| Permission | Scope? | What Happens When ON | What Happens When OFF |
| --- | --- | --- | --- |
| `ticket.view` | Yes | User can open ticket lists, ticket details, messages, timelines, and escalation views inside their scope. | Ticket pages and ticket details are blocked unless another role grants ticket view. |
| `ticket.create` | No | User can create a ticket manually or from allowed ticket creation flows. | User cannot create new tickets from staff/dashboard actions. |
| `ticket.assign` | No | User can update ticket assignment and ticket routing-related fields. | Assignment/edit controls are blocked. |
| `ticket.accept` | No | User can accept a visible dispatched ticket. | User should not be given accept workflow access unless another permission allows it. |
| `ticket.reject` | No | User can reject a visible dispatched ticket. | User should not be given reject workflow access unless another permission allows it. |
| `ticket.complete_own` | No | User can complete visible assigned work where the workflow allows completion. | User cannot complete tickets using this permission. |
| `ticket.close` | No | User can close or cancel ticket workflow states where close is required. | Close/cancel transition is blocked. |
| `ticket.delete` | No | User can delete tickets where delete support is exposed. | Ticket deletion is blocked. |
| `ticket.approve` | No | User can approve or reopen tickets in approval workflow states. | Approval and reopen actions are blocked. |
| `ticket.verify` | No | User can verify completed tickets where verification is enabled. | Verification is blocked. |

Recommended setup:

| Role | Suggested Ticket Permissions |
| --- | --- |
| Staff | `ticket.view` Own, `ticket.accept`, `ticket.reject`, `ticket.complete_own` |
| Supervisor | `ticket.view` Department, `ticket.assign`, `ticket.accept`, `ticket.reject`, `ticket.approve` |
| Manager | `ticket.view` Hotel, `ticket.assign`, `ticket.approve`, `ticket.verify`, `ticket.close` |

Important:

Ticket actions still respect visibility. A user cannot act on a ticket outside their view scope.

## Staff

Staff permissions control the Staff settings area and staff profile access.

| Permission | Scope? | What Happens When ON | What Happens When OFF |
| --- | --- | --- | --- |
| `staff.view` | Yes | User can see staff records within the selected scope. | Staff list/profile access is blocked unless another role grants it. |
| `staff.create` | No | User can create staff users. | New staff creation is blocked. |
| `staff.update` | Yes | User can edit staff records within the selected scope. | Staff edit is blocked unless another role grants update/manage. |
| `staff.delete` | No | User can delete/deactivate staff where deletion is exposed. | Staff deletion is blocked. |
| `staff.manage` | No | User gets broad staff administration access. | Staff administration must come from specific lower permissions. |

Recommended setup:

| Role | Suggested Staff Permissions |
| --- | --- |
| Staff | `staff.view` Own |
| Supervisor | `staff.view` Department |
| HR/Admin | `staff.view` Hotel, `staff.create`, `staff.update` Hotel |
| Owner/Manager | `staff.manage` |

## Shifts

Shift permissions control staff shift visibility and shift status updates.

| Permission | Scope? | What Happens When ON | What Happens When OFF |
| --- | --- | --- | --- |
| `shift.view` | Yes | User can see shifts within the selected scope. | Shift lists are blocked unless another role grants shift visibility. |
| `shift.update` | Yes | User can update shift status/details within the selected scope. | Shift update is blocked. |
| `shift.manage` | No | User can create, bulk create, manage, and administer shifts. | Shift administration is blocked unless lower permissions allow limited access. |

Recommended setup:

| Role | Suggested Shift Permissions |
| --- | --- |
| Staff | `shift.view` Own, `shift.update` Own |
| Supervisor | `shift.view` Department, `shift.update` Department |
| Manager/Admin | `shift.manage` |

## Rooms

Rooms permissions control room inventory screens.

| Permission | What Happens When ON | What Happens When OFF |
| --- | --- | --- |
| `room.view` | User can view rooms and room types. | Room pages are blocked. |
| `room.create` | User can create rooms where exposed. | Room creation is blocked. |
| `room.update` | User can edit rooms and room types. | Room edit controls are blocked. |
| `room.delete` | User can delete rooms where exposed. | Room deletion is blocked. |

Recommended:

- Reception and managers usually need `room.view`.
- Only managers/admins should get `room.create`, `room.update`, or `room.delete`.

## Guests

Guest permissions control guest records and guest-related information.

| Permission | What Happens When ON | What Happens When OFF |
| --- | --- | --- |
| `guest.view` | User can view guest list/profile areas. | Guest pages are blocked. |
| `guest.view_basic` | User can view basic guest data where supported. | Basic guest-only access is not granted. |
| `guest.view_sensitive` | User can view sensitive guest data where supported. | Sensitive guest fields should stay hidden where masking is implemented. |
| `guest.create` | User can create guests or guest-linked records from allowed flows. | Guest creation is blocked. |
| `guest.edit` | User can edit guest and guest-linked reservation information where this permission is required. | Guest edit is blocked. |
| `guest.checkout` | User can perform guest/reservation checkout flows. | Checkout is blocked. |

Recommended:

- Front desk: `guest.view`, `guest.create`, `guest.edit`, `guest.checkout`.
- Limited staff: `guest.view_basic` only, if they need basic context.
- Sensitive guest data should be reserved for trusted staff.

## Reservations

Reservation permissions control booking and stay records.

| Permission | What Happens When ON | What Happens When OFF |
| --- | --- | --- |
| `reservation.view` | User can view reservation screens where reservation permission is checked. | Reservation views are blocked where this permission is required. |
| `reservation.create` | User can create reservations where exposed. | Reservation creation is blocked. |
| `reservation.update` | User can edit reservation details where exposed. | Reservation edit is blocked. |
| `reservation.cancel` | User can cancel reservations. | Cancellation is blocked. |
| `reservation.checkout` | User can complete reservation checkout where exposed. | Reservation checkout is blocked. |
| `reservation.manage` | User can broadly create and manage reservations. | User needs individual reservation permissions instead. |

Note:

Some current reservation routes also use guest permissions because reservations are closely linked to guest profiles. For front desk roles, grant both guest and reservation permissions.

## Roles And Permissions

Role permissions control who can configure access.

| Permission | What Happens When ON | What Happens When OFF |
| --- | --- | --- |
| `role.view` | User can view role list and permission matrix. | Role settings are hidden or blocked. |
| `role.manage` | User can create, update, delete roles, and assign role permissions. | Role editing and role assignment are blocked. |

Warning:

Give `role.manage` only to trusted admins. A user with role management can grant powerful access to others.

## Hotel Settings And Admin Areas

| Permission | What Happens When ON | What Happens When OFF |
| --- | --- | --- |
| `hotel.settings.manage` | User can manage hotel settings, SLA, routing, escalation rules, AI settings, some operational admin pages, and audit/admin functions. | Hotel configuration pages are blocked. |
| `hotel.billing.view` | User can view hotel billing details. | Hotel billing details are blocked. |
| `billing.view` | User can view billing-related pages where this permission is used. | Billing views are blocked. |

Recommended:

Give `hotel.settings.manage` only to owners, general managers, or system admins.

## Workflow, Escalation, Routing, And SLA

| Permission | What Happens When ON | What Happens When OFF |
| --- | --- | --- |
| `workflow.manage` | User can manage custom workflow definitions where workflow management is exposed. | Workflow management is blocked. |
| `hotel.settings.manage` | User can manage escalation rules, routing rules, task SLA rules, and many hotel configuration pages. | SLA/routing/escalation setup pages are blocked. |

Operational note:

SLA, routing, and escalation configuration is powerful. It changes how tickets move, who receives them, and when they escalate. Keep it limited to managers/admins.

## Analytics

| Permission | What Happens When ON | What Happens When OFF |
| --- | --- | --- |
| `analytics.view` | User can view analytics/overview areas where analytics permission is checked. | Analytics pages are hidden or blocked. |
| `analytics.export` | User can export analytics/platform reports where exposed. | Export actions are blocked. |

Recommended:

- Managers can receive `analytics.view`.
- Only trusted roles should receive `analytics.export`.

## WhatsApp, Chat, Bot, And Campaigns

| Permission | What Happens When ON | What Happens When OFF |
| --- | --- | --- |
| `whatsapp.health.view` | User can view WhatsApp health and usage information. | WhatsApp health/usage views are blocked. |
| `live_chat.manage` | User can manage live chat handoff and WhatsApp human handoff flows. | Live chat handoff management is blocked. |
| `bot.view` | User can view bot configuration and knowledge base. | Bot/AI knowledge views are blocked. |
| `bot.manage` | User can manage bot configuration and knowledge content. | Bot configuration edits are blocked. |
| `bot.publish` | User can publish or rollback bot versions. | Publish/rollback is blocked. |
| `campaign.view` | User can view campaigns. | Campaign views are blocked. |
| `campaign.create` | User can create campaigns. | Campaign creation is blocked. |
| `campaign.send` | User can send campaigns. | Campaign sending is blocked. |

Warning:

`campaign.send` can message guests. Give it only to approved marketing or management users.

## Menu, F&B, And Restaurant

| Permission | What Happens When ON | What Happens When OFF |
| --- | --- | --- |
| `menu.view` | User can view menu configuration or menu data where protected. | Menu views are blocked. |
| `menu.manage` | User can create/edit/delete menu categories and items. | Menu edits are blocked. |
| `restaurant.manage` | User can manage restaurant POS, tables, orders, and KOT-related operations where exposed. | Restaurant admin operations are blocked. |

Recommended:

- F&B manager: `menu.manage`, `restaurant.manage`.
- Service staff may need only operational ticket permissions depending on workflow.

## Financial And Revenue

| Permission | What Happens When ON | What Happens When OFF |
| --- | --- | --- |
| `folio.view` | User can view guest folios. | Folio views are blocked. |
| `folio.manage` | User can manage folios, charges, payments, refunds, and related financial actions where exposed. | Folio financial edits are blocked. |
| `rate_plan.manage` | User can manage rate plans and revenue setup. | Rate plan management is blocked. |

Recommended:

Limit financial permissions to front office managers, finance users, and owners.

## Operations

| Permission | What Happens When ON | What Happens When OFF |
| --- | --- | --- |
| `housekeeping.manage` | User can manage housekeeping tasks and schedules where exposed. | Housekeeping admin actions are blocked. |
| `maintenance.manage` | User can manage maintenance orders where exposed. | Maintenance admin actions are blocked. |
| `lost_found.manage` | User can manage lost and found records where exposed. | Lost and found admin actions are blocked. |

Note:

Some housekeeping and maintenance screens also use ticket permissions because those records can create or update tickets.

## Inventory

| Permission | What Happens When ON | What Happens When OFF |
| --- | --- | --- |
| `inventory.manage` | User can manage inventory items, stock transactions, vendors, purchase orders, and purchase order items. | Inventory operations are blocked. |

Recommended:

Give this to store, purchasing, or manager roles only.

## Media

| Permission | What Happens When ON | What Happens When OFF |
| --- | --- | --- |
| `media.manage` | User can manage media files where exposed. | General media management is blocked. |
| `media.upload` | User can upload media files. | Upload is blocked. |
| `media.delete` | User can delete media files. | Delete is blocked. |

Recommended:

Allow upload more broadly than delete. Keep delete restricted.

## SaaS, Organization, And Platform-Like Hotel Controls

| Permission | What Happens When ON | What Happens When OFF |
| --- | --- | --- |
| `feature.manage` | User can manage SaaS features and limits where exposed. | Feature management is blocked. |
| `organization.manage` | User can manage organization hotels where exposed. | Organization management is blocked. |

Recommended:

These should usually stay with owner/admin roles.

## Navigation Visibility

The dashboard uses permissions to decide which navigation items and pages should appear.

Examples:

- Ticket access can show ticket navigation.
- Analytics access can show overview/analytics areas.
- Staff access can show staff pages.
- Role access can show role settings.

If a menu item does not appear:

1. Check the user's assigned roles.
2. Check if the role has the required permission.
3. Check if the user has refreshed after the role change.
4. Check if another condition is needed, such as department assignment.

## Department Assignment Matters

Department scope only works correctly when the user has a department.

Example:

If a supervisor has `ticket.view` with Department scope but no department assigned, the system cannot know which department's tickets they should see.

For Department scope roles, always set:

- Department
- Staff level or job role
- Reporting manager, if your workflow uses hierarchy

## Common Role Templates

### Basic Operational Staff

Use for housekeeping attendants, engineering technicians, or service staff.

Recommended:

- `ticket.view` Own
- `ticket.accept`
- `ticket.reject`
- `ticket.complete_own`
- `shift.view` Own
- `shift.update` Own

### Department Supervisor

Use for housekeeping supervisor, engineering supervisor, or F&B supervisor.

Recommended:

- `ticket.view` Department
- `ticket.assign`
- `ticket.accept`
- `ticket.reject`
- `ticket.approve`
- `staff.view` Department
- `shift.view` Department
- `shift.update` Department

### Receptionist

Use for front desk staff.

Recommended:

- `ticket.view` Hotel or Department, depending on process
- `ticket.create`
- `ticket.assign`
- `ticket.accept`
- `ticket.reject`
- `guest.view`
- `guest.create`
- `guest.edit`
- `guest.checkout`
- `reservation.view`
- `reservation.create`
- `reservation.update`
- `room.view`

### Manager

Use for hotel managers.

Recommended:

- `ticket.view` Hotel
- `ticket.assign`
- `ticket.approve`
- `ticket.verify`
- `staff.view` Hotel
- `staff.update` Hotel
- `shift.manage`
- `room.view`
- `reservation.manage`
- `analytics.view`

### Owner Or Admin

Use for hotel owner or trusted system admin.

Recommended:

- `role.view`
- `role.manage`
- `hotel.settings.manage`
- `staff.manage`
- `shift.manage`
- `analytics.view`
- Any module-specific manage permissions needed for the business

## What To Do After Changing A Role

After editing a role:

1. Save the role.
2. Ask the staff user to refresh the dashboard.
3. If the user still sees old access, ask them to sign out and sign in again.
4. Confirm the user is assigned to the correct role.
5. Confirm the user has a department if the role uses Department scope.

The app refreshes `/auth/me` periodically and on focus, so full relogin is usually not required. A hard refresh is enough in most cases.

## Troubleshooting

### Staff Cannot See Any Navigation

Check:

- Does the user have at least one role?
- Does the role contain view permissions for the needed module?
- Did the user refresh after the role was assigned?
- Is the user's account active?

### Staff Can See Page But List Is Empty

Check:

- Is the permission scoped to Own or Department?
- Is the record assigned to the staff user?
- Is the record in the same department?
- Does the staff user have a department assigned?

### Staff Gets Access Denied

Access denied usually means:

- Permission is missing.
- Scope does not include that record.
- User belongs to another hotel.
- Token/session is stale and needs refresh or login.

### Supervisor Cannot See Department Tickets

Check:

- Role has `ticket.view` with Department scope.
- Supervisor has the correct department assigned.
- Tickets have the correct department set.

### Staff Can View But Cannot Edit

View and edit are separate.

Example:

`staff.view` lets a user see staff records. It does not allow editing staff. For editing, add `staff.update` with the correct scope.

### Role Change Does Not Apply Immediately

Try:

1. Refresh the page.
2. Sign out and sign in.
3. Confirm role assignment saved.
4. Confirm backend is running against the migrated database.

## Legacy Permission Compatibility

Older roles may still contain old permission names. They continue to work.

| Old Permission | Current Meaning |
| --- | --- |
| `ticket.view_own` | `ticket.view` with Own scope |
| `ticket.view_dept` | `ticket.view` with Department scope |
| `ticket.view_all` | `ticket.view` with Hotel scope |
| `shift.view_own` | `shift.view` with Own scope |
| `shift.view_dept` | `shift.view` with Department scope |
| `shift.update_own` | `shift.update` with Own scope |
| `user.view` | Same as `staff.view` |
| `user.create` | Same as `staff.create` |
| `user.update` | Same as `staff.update` |
| `user.delete` | Same as `staff.delete` |
| `user.manage` | Same as `staff.manage` |

When editing roles, use the current names shown in the role editor.

## Safe Configuration Rules

Use these rules when unsure:

1. Give staff the smallest scope that lets them do their job.
2. Use Own for individual workers.
3. Use Department for supervisors.
4. Use Hotel for managers.
5. Keep `manage` permissions limited.
6. Keep `role.manage` limited to owners/admins.
7. Keep financial, billing, campaign send, and hotel settings permissions limited.
8. Test with a real staff login after changing role rules.

## Quick Decision Guide

| Need | Permission To Use |
| --- | --- |
| See own tickets | `ticket.view` + Own |
| See department tickets | `ticket.view` + Department |
| See all tickets | `ticket.view` + Hotel |
| Create tickets | `ticket.create` |
| Assign tickets | `ticket.assign` |
| Approve tickets | `ticket.approve` |
| See own profile | `staff.view` + Own |
| See department staff | `staff.view` + Department |
| Edit department staff | `staff.update` + Department |
| See own shifts | `shift.view` + Own |
| Update own shift | `shift.update` + Own |
| Manage all shifts | `shift.manage` |
| Manage role permissions | `role.manage` |
| Configure SLA/routing/escalation | `hotel.settings.manage` |
| View analytics | `analytics.view` |
| Export analytics | `analytics.export` |
| Manage bot content | `bot.manage` |
| Publish bot version | `bot.publish` |
| Send campaigns | `campaign.send` |

