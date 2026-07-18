# RBAC Web App and Backend Improvement Report

Generated: 2026-07-18

## Scope

This report reviews the RBAC implementation across:

- Backend permission registry, role models, RBAC service, API dependencies, route guards, mobile compatibility routes, role assignment, scopes, and cache behavior.
- Web app permission constants, CASL ability builder, navigation filtering, role editor, permission matrix, access denied handling, and staff/role UI behavior.

This is an implementation analysis, not a full penetration test. The most important security-sensitive findings should still be validated with targeted tests before production release.

## Executive Summary

The RBAC foundation is stronger than the current user experience suggests. The backend has a central `RBACService`, role and permission tables, scoped grants, owner bypass, cache invalidation on most role changes, and route dependencies such as `require_permission(...)` and `require_any_permission(...)`.

The main problem is consistency. Backend permissions, frontend ability rules, navigation visibility, scoped behavior, and legacy/mobile endpoints do not all use the same policy model. That makes the system feel unpredictable: an admin may grant a permission but the web UI hides the page, or the UI may show a control that the backend later rejects.

Highest priority improvements:

1. Lock down the mobile compatibility API so it uses the same RBAC checks as the web API.
2. Define one permission contract and generate or validate both backend and frontend behavior from it.
3. Fix frontend navigation and CASL ability logic so it understands backend equivalents, implied manage permissions, and scoped permissions.
4. Clarify the scope model so admins can see which permissions support `own`, `department`, and `hotel`, and which permissions are always hotel-wide.
5. Add safety around system roles, high-risk permissions, password resets, self-lockout, and stale permission caches.

## Current Architecture Snapshot

### Backend

Important files:

- `backend/app/core/permissions.py`
- `backend/app/models/rbac.py`
- `backend/app/repositories/rbac_repository.py`
- `backend/app/services/rbac_service.py`
- `backend/app/api/dependencies.py`
- `backend/app/api/v1/roles.py`
- `backend/app/api/v1/users.py`
- `backend/tests/test_v52_platform_rbac_upgrade.py`

Observed model:

- Permissions are registered as string codes such as `ticket.view`, `staff.manage`, and `hotel.settings.manage`.
- Roles are hotel-scoped and can have many permissions through `role_permissions`.
- `role_permissions.scope` stores `own`, `department`, or `hotel`.
- `RBACService.require(...)` is the central backend check used by route dependencies.
- Hotel owners bypass permission checks through `is_hotel_owner`.
- `resource.manage` implies the matching action permission in `RBACService.has_permission(...)`.
- Legacy scoped permissions such as `ticket.view_own` and `shift.view_dept` are mapped to base permissions plus scope.
- Backend treats `user.*` and `staff.*` as equivalent for common staff-management permissions.
- `/auth/me` returns live permissions and `permission_scopes`.
- Role changes clear the local permission cache.

### Web App

Important files:

- `apps/dashboard/src/constants/permissions.ts`
- `apps/dashboard/src/lib/auth/ability.ts`
- `apps/dashboard/src/lib/auth/can.tsx`
- `apps/dashboard/src/components/layout/dashboard-shell.tsx`
- `apps/dashboard/src/features/roles/components/roles-page.tsx`
- `apps/dashboard/src/features/roles/components/role-editor-page.tsx`
- `apps/dashboard/src/features/roles/components/permission-matrix.tsx`
- `apps/dashboard/src/components/access-denied-dialog.tsx`

Observed model:

- Frontend constants match the backend permission registry by code.
- CASL ability rules are manually mapped in `buildAbility(...)`.
- Navigation visibility is manually filtered in `DashboardShell`.
- Role editor uses `/roles/permissions`, which returns assignable permissions.
- Permission matrix only exposes scopes for `ticket.view`, `shift.view`, `shift.update`, `staff.view`, and `staff.update`.
- `Can` wrappers protect selected buttons/actions, but many pages still rely mainly on backend API errors.

### Metrics From The Codebase

- Backend permission constants found: 73.
- Frontend permission constants found: 73.
- Difference between backend and frontend constants: none found.
- Backend route permission guard references found: 264.
- Raw `Depends(get_current_user)` references under `backend/app/api/v1`: 51.
- Frontend permission constants not referenced in `buildAbility(...)`: 28.

The constants are aligned, but the behavior is not.

## Key Findings

| ID | Severity | Area | Finding | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- |
| F-01 | Critical | Backend mobile API | `backend/app/api/v1/mobile.py` uses `get_current_user` plus hotel access for many user, task, inventory, chat, and upload operations. The service layer uses legacy role strings and staff level checks, not the central RBAC policy. | A hotel user with mobile access may reach operations that the web API would protect with granular permissions. | Put the same `require_permission(...)` or record-level `RBACService` checks on mobile endpoints, then add mobile RBAC regression tests. |
| F-02 | High | Backend role safety | System roles are protected from delete, but role update and permission replacement paths should also be explicitly guarded or deliberately documented as editable. | Admins can accidentally weaken or overgrant built-in roles such as Manager, Receptionist, or Staff. | Block direct edits to system roles and provide "clone system role" for customization, or add a separate guarded workflow for editing them. |
| F-03 | High | Backend route taxonomy | Several domains use permissions from another domain: reservations often use `guest.*`, folios mix `guest.*`, `folio.*`, and `hotel.settings.manage`, housekeeping and maintenance use `ticket.*`, and task SLA/routing settings use `hotel.settings.manage`. | Roles become hard to reason about. Granting one permission may unlock unrelated workflows. | Build a route-to-permission matrix and normalize each route to its domain permission. Keep aliases only as temporary migration support. |
| F-04 | High | Frontend navigation | `DashboardShell.canAccessNavItem(...)` checks raw permission strings only. It does not apply backend equivalents like `staff.view` vs `user.view`, implied manage permissions, or scoped base permissions. | A user can be allowed by the backend but unable to see the page, or see a menu that later fails. | Create a shared frontend `hasPermission` helper that mirrors backend logic, then use it for nav and buttons. |
| F-05 | High | Frontend ability | `buildAbility(...)` does not map many existing permissions: examples include `menu.manage`, `campaign.*`, `folio.*`, `inventory.manage`, `restaurant.manage`, `media.*`, `billing.view`, `hotel.billing.view`, `bot.publish`, and checkout permissions. | `Can` wrappers are incomplete and cannot be trusted as a full UI policy layer. | Generate ability rules from a permission registry or make the map exhaustive with tests that fail when a permission is unmapped. |
| F-06 | Medium | Scope model | Scopes are stored generically, but enforcement is concentrated around tickets, staff, and shifts. The role editor only exposes scopes for five permission codes. | Admins can grant scopes that appear meaningful but do not apply consistently across records or domains. | Mark each permission with `scope_supported: true/false` and only show scope controls for permissions with backend record-level enforcement. |
| F-07 | Medium | Permission cache | The permission cache is process-local with a TTL. Role changes clear the current process cache only. | In multi-worker or multi-instance deployment, users may keep stale permissions until TTL or instance restart. | Add a shared permission version stamp or distributed invalidation through Redis/pubsub/database versioning. |
| F-08 | Medium | Manage and scope semantics | `resource.manage` implies action checks, but scope lookup and some record-level checks do not consistently derive scope from manage permissions. | "Manage" can behave differently depending on whether the endpoint uses a route check or a record-level policy helper. | Define manage as hotel-wide for that resource, or require scoped manage grants explicitly, then implement consistently in `permission_scope(...)`. |
| F-09 | Medium | High-risk actions | Role management, staff management, password reset, billing, integrations, and media deletion are not labeled as high-risk in the UI. | Admins cannot easily tell which permissions can create security, financial, or operational risk. | Add risk metadata to permissions and show warnings/confirmation for high-risk grants. Consider a dedicated `staff.password.reset` permission. |
| F-10 | Medium | Frontend route gates | Several pages expose primary actions before API denial. `RolesPage` shows new/edit/delete actions without frontend `role.manage` gating. | Direct navigation produces confusing screens and late failures. | Add page-level and action-level guards for role/staff/settings pages, with a clear access-denied state before data mutation. |
| F-11 | Medium | Legacy admin checks | Some backend and frontend checks still use `staff_level`, `user_type`, or `isHotelAdmin` instead of RBAC permissions. | Admin behavior becomes split between legacy fields and roles. | Keep only owner bypass as a special case; move admin-only functionality to explicit permissions such as `audit.view` or `role.manage`. |
| F-12 | Medium | Effective access visibility | Staff profile role assignment shows role checkboxes but not effective permissions, scopes, inherited grants, or why access exists. | Super admins cannot confidently audit a staff member's real access. | Add an "Effective access" panel to staff profile and role editor previews. |
| F-13 | Low | Access denied UX | The access denied dialog infers permissions from URLs and error text. | Error messaging can become brittle as routes evolve. | Return structured 403 data from the backend: required permissions, required scope, subject, and action. |
| F-14 | Low | Query invalidation | Assigning roles invalidates staff data but should also refresh current-user permissions when the edited user is the current session. | Admins may need to refresh before seeing changed access. | Invalidate `/auth/me` or call an auth refresh after role assignment when needed. |

## Backend Analysis

### What Is Working

- Central RBAC checks are available through `RBACService.require(...)`, `has_permission(...)`, and `has_any(...)`.
- Permission assignment supports scopes at the data model level.
- Legacy scoped codes are normalized, which protects older role data during migration.
- `user.*` and `staff.*` equivalence helps bridge the staff/user naming transition.
- `/auth/me` uses live backend role state instead of trusting token-embedded permissions.
- Role create/update/delete/assign actions write audit logs.
- Tests already cover important behavior such as owner bypass, role assignment, live permission updates, scoped ticket visibility, staff scope updates, and shift scope behavior.

### Main Backend Gaps

#### 1. Mobile Compatibility API Needs RBAC Alignment

The mobile routes authenticate the user and call `_ensure_mobile_hotel(...)`, but many endpoints do not require domain permissions. Examples include listing users, creating or updating users, deleting users, listing/updating/deleting tasks, inventory actions, chat actions, claim notifications, escalation reads, FCM token operations, and media upload.

The service layer also contains its own role interpretation using `job_role`, `staff_level`, `user_type`, and `is_hotel_owner`. That creates a parallel authorization model beside `RBACService`.

Recommended fix:

- Add the same permission dependencies used by web API endpoints to mobile endpoints.
- For task visibility and mutation, use `RBACService.can_view_ticket(...)` and action-specific checks.
- For user list/update/delete, use staff/user permissions and staff scope checks.
- For inventory, chat, media, and notifications, map each mobile route to the same domain permission as the web route.
- Add tests proving a low-privilege mobile user cannot create/delete users, mutate other users' tasks, or list hotel-wide data.

#### 2. Permission Taxonomy Is Not Yet Clean

Some route guards do not match the resource being operated on. This may be intentional historical compatibility, but it makes roles difficult to explain.

Examples:

- Reservation routes often require `guest.view`, `guest.create`, or `guest.edit` instead of `reservation.view`, `reservation.create`, or `reservation.update`.
- Folio routes mix `guest.view`, `guest.edit`, `folio.view`, `folio.manage`, and `hotel.settings.manage`.
- Housekeeping, maintenance, and live chat often reuse ticket permissions.
- Department, routing, escalation, SLA, and rate-plan settings commonly use `hotel.settings.manage`.

Recommended fix:

- Create a route policy table with one row per endpoint: method, path, permission, scope, subject type, and record policy.
- Normalize guards to domain-specific permissions.
- Keep legacy aliases temporarily where existing customers depend on older grants.
- Add a test that every protected route references a registered permission.

#### 3. System Roles Need Stronger Guardrails

System roles are seeded with important defaults. Deleting them is blocked, but updating role metadata or replacing permissions should also have explicit protection.

Recommended fix:

- Either block edits to system roles or require a separate "system role override" permission that ordinary hotel admins do not have.
- Prefer a "Clone" action in the UI so admins can customize from Manager/Receptionist/Staff safely.

#### 4. Scope Needs A Formal Contract

The backend can store scopes for any role permission, but record-level enforcement is only implemented for selected domains. That is fine as an incremental model, but the role editor should not suggest that all permissions are meaningfully scoped.

Recommended fix:

- Add permission metadata:

```yaml
code: staff.view
module: staff
action: view
scope_supported: true
scope_values: [own, department, hotel]
risk: medium
frontend_subject: Staff
frontend_actions: [view]
```

- Use that metadata in both backend validation and frontend rendering.
- Reject unsupported scopes at the API boundary or normalize them to `hotel` with a clear response.

#### 5. Permission Cache Should Work Across Instances

Current cache invalidation appears process-local. That is acceptable for development and one-process deployment, but can cause stale access in production with multiple API workers.

Recommended fix:

- Add a `hotel_permission_version` or `user_permission_version` field.
- Include the version in cache keys.
- Increment the version on role permission changes and role assignment.
- Optionally broadcast invalidation through Redis or another shared channel.

## Web App Analysis

### What Is Working

- Frontend permission constants match backend permission codes.
- The auth store receives live permissions from `/auth/me`.
- A CASL-based `Can` component exists and protects selected actions.
- Role editor supports assigning permissions and scopes.
- Navigation hides most modules for users without matching permissions.
- Access denied messaging exists and tries to explain missing permissions.

### Main Web App Gaps

#### 1. Ability Builder Is Incomplete

The permission constants are present, but many are not mapped into `buildAbility(...)`. Missing ability mappings include:

- `ticket.view_own`
- `ticket.verify`
- `guest.checkout`
- `reservation.checkout`
- `menu.view`
- `menu.manage`
- `bot.publish`
- `campaign.view`
- `campaign.create`
- `campaign.send`
- `hotel.billing.view`
- `analytics.export`
- `folio.view`
- `folio.manage`
- `rate_plan.manage`
- `maintenance.manage`
- `lost_found.manage`
- `organization.manage`
- `inventory.manage`
- `restaurant.manage`
- `feature.manage`
- `media.manage`
- `media.upload`
- `media.delete`
- `billing.view`

Recommended fix:

- Make ability mappings exhaustive.
- Add a unit test that fails when a permission constant is not handled or explicitly marked `backend_only`.
- Include implied manage behavior: if the user has `staff.manage`, the UI should allow staff view/create/edit/delete/manage actions.

#### 2. Navigation Uses A Different Policy Than Backend

Navigation uses a raw permission set. It does not understand:

- `staff.*` and `user.*` equivalence.
- `resource.manage` implying `resource.view`, `resource.create`, etc.
- Scoped base permissions returned through `permission_scopes`.
- Legacy scoped aliases normalized by the backend.

Example:

- Staff settings nav requires `user.view` or `user.manage`, but backend also supports `staff.view` and `staff.manage`.

Recommended fix:

- Build a frontend helper such as `hasPermission(user, code)` that mirrors backend equivalence and manage implication.
- Add `hasAnyPermission(...)` and `hasScopeAtLeast(...)`.
- Use these helpers in navigation, page gates, and action gates.

#### 3. Role Editor Scope UX Is Too Small And Too Broad At The Same Time

The current permission matrix only exposes scope selectors for five permissions. That helps avoid clutter, but it is hard-coded and detached from backend metadata.

Recommended fix:

- Drive the permission matrix from backend metadata.
- Show scope only where record-level enforcement exists.
- Add role preview sections:
  - Effective permissions
  - Scoped data visibility
  - High-risk permissions
  - Dependent permissions
  - Users assigned to this role

#### 4. Staff Profile Should Show Effective Access

The staff profile now includes role assignment and password reset workflow, but RBAC review should go one step further. Super admins need to see the actual access produced by selected roles.

Recommended fix:

- Add an "Effective access" section beside role assignment.
- Show merged permissions from all roles.
- Show scope per scoped permission.
- Highlight high-risk permissions such as `role.manage`, `staff.manage`, `user.manage`, `hotel.billing.view`, `media.delete`, and password reset authority.
- Consider adding a dedicated `staff.password.reset` permission instead of hiding this power under broad manage permission only.

#### 5. Direct Page Access Should Fail Earlier And Cleaner

Some pages are hidden from navigation but still render if visited directly. Backend API calls then fail later.

Recommended fix:

- Add page-level guards for settings/staff, settings/roles, workflow, audit, AI configuration, billing, media, and other sensitive areas.
- Use the same `hasPermission(...)` helper as navigation.
- Show a consistent access-denied panel before loading data or rendering mutation actions.

## Recommended Target Model

Move toward a single permission registry that drives both sides.

Suggested registry fields:

```yaml
- code: ticket.view
  label: View tickets
  module: Tickets
  resource: ticket
  action: view
  scope_supported: true
  scopes: [own, department, hotel]
  risk: low
  frontend_subject: Ticket
  frontend_actions: [view]
  implies: []
  legacy_aliases: [ticket.view_own, ticket.view_dept, ticket.view_all]

- code: staff.manage
  label: Manage staff
  module: Staff
  resource: staff
  action: manage
  scope_supported: false
  risk: high
  frontend_subject: Staff
  frontend_actions: [view, create, edit, delete, manage]
  equivalent_permissions: [user.manage]
```

Backend should use this registry to seed permissions and validate role assignments.

Frontend should use this registry to generate:

- Permission constants.
- Ability mappings.
- Navigation checks.
- Permission matrix grouping and scope controls.
- High-risk labels.
- Access denied labels.

## Improvement Roadmap

### Phase 1: Safety And Consistency

1. Add RBAC guards to mobile compatibility routes.
2. Block or explicitly gate edits to system roles.
3. Add frontend `hasPermission`, `hasAnyPermission`, and scope helpers matching backend semantics.
4. Update navigation to use the shared helper.
5. Make `buildAbility(...)` exhaustive or generated.
6. Add page-level guards for roles, staff, workflow, audit logs, billing, media, and settings pages.
7. Add tests for `staff.view` showing staff navigation and `staff.manage` enabling staff actions.
8. Add tests for mobile low-privilege denial.

### Phase 2: Permission Contract

1. Create a backend-owned permission registry with metadata.
2. Generate frontend constants and ability metadata from the registry.
3. Create a route permission matrix and normalize mismatched route guards.
4. Add structured 403 responses with required permission and scope data.
5. Add an effective permissions endpoint for a user.

### Phase 3: Admin UX

1. Add effective access summary to staff profile.
2. Add role preview and role diff in role editor.
3. Add high-risk warnings for role management, staff management, password reset, billing, integrations, and media delete.
4. Add "clone system role" workflow.
5. Add "test as role/user" read-only preview mode for super admins.

### Phase 4: Production Hardening

1. Move permission cache invalidation to a shared version or distributed invalidation model.
2. Add audit logs with before/after role permission diffs.
3. Add self-lockout protections for role admins.
4. Add CI tests that compare frontend permission coverage against backend registry.
5. Add monitoring for repeated 403s by route and role to find misconfigured roles.

## Suggested Backend Test Matrix

Add or extend tests for:

- Low-privilege mobile user cannot list, create, update, or delete staff.
- Low-privilege mobile user cannot mutate tasks outside own/department scope.
- `staff.view` and `user.view` remain equivalent on backend and frontend fixtures.
- `staff.manage` and `user.manage` imply staff view/create/update/delete where intended.
- System role update and permission replacement are blocked or require special authorization.
- Role assignment cannot remove the last effective role manager without warning or explicit override.
- Each route guard references a registered permission.
- Scoped ticket, staff, and shift access behaves the same through web and mobile routes.
- `/auth/me` changes after role assignment without requiring logout.

## Suggested Frontend Test Matrix

Add tests for:

- Navigation visibility for `staff.view`, `staff.manage`, `user.view`, and `user.manage`.
- Navigation visibility for scoped `ticket.view` with `department` and `hotel`.
- Ability coverage for every permission constant.
- Role editor renders scope controls only for permissions where backend supports scopes.
- Role editor blocks or redirects system role editing when backend blocks it.
- Role assignment refreshes current-user permissions when the edited user is the signed-in user.
- Access-denied panel uses structured backend error metadata.

## Proposed Immediate Backlog

Recommended implementation order:

1. Patch mobile compatibility routes with RBAC checks.
2. Add system role edit protection in `RBACService.update_role(...)` and `set_role_permissions(...)`.
3. Add frontend permission helper matching backend equivalence and manage implication.
4. Replace `DashboardShell.canAccessNavItem(...)` with the helper.
5. Expand `buildAbility(...)` mappings and add an exhaustive coverage test.
6. Add page-level guards to Roles and Staff settings pages.
7. Add effective permissions endpoint and show it on staff profile.
8. Move permission scope metadata into backend permission response.
9. Update `PermissionMatrix` to use backend-provided scope metadata.
10. Normalize reservation, folio, housekeeping, maintenance, and settings route permissions.
11. Add structured authorization error payloads.
12. Add distributed permission cache invalidation before multi-instance deployment.

## Bottom Line

The RBAC feature is not broken at its core. The backend has a usable permission engine, and the frontend has the beginnings of an authorization-aware UI. The gap is that there are too many separate interpretations of permissions.

The best improvement is to make RBAC contract-driven: one permission registry, one scope policy, one frontend helper, one route matrix, and one set of tests proving the web app and backend agree.
