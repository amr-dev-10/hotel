# Staff, Hierarchy, And Housekeeping

These features support hotel team operations, staff visibility, department
hierarchy, and housekeeping task work.

## Main Files

| Area | Main files |
| --- | --- |
| Staff | Operations screens, staff popup, `src/modules/staff` in dashboard app counterpart |
| Hierarchy | `HierarchyScreen` rendering path in operations screens |
| Housekeeping | `src/modules/housekeeping/`, operations screens |
| Shared data | `useOperationsWorkspace`, operations resource endpoints |

## Endpoints

| Resource | Endpoint |
| --- | --- |
| Staff/users | `/api/v1/hotels/{hotelId}/users?limit=200` |
| Housekeeping | `/api/v1/hotels/{hotelId}/housekeeping?limit=20` |

Hierarchy requests are handled by the hierarchy screen through the shared
`request` function.

## Screen Keys

| Feature | Screen key |
| --- | --- |
| Staff portal | `staff` |
| Hierarchy | `hierarchy` |
| Housekeeping | `housekeeping` |

## Data Dependencies

Housekeeping screen receives:

- `tasks`
- `rooms`
- `staff`
- `hotelId`
- `request`

Staff screen receives:

- `staff`
- `hotelId`
- `request`
- `onRefreshResource`

Hierarchy screen receives:

- `hotelId`
- `request`
- `userDepartmentId`

## Permissions

| Screen/action | Permission group |
| --- | --- |
| Staff | Staff view, user view, or shift view permissions. |
| Staff profile popup | Staff view or user view. |
| Hierarchy | User view or staff view. |
| Housekeeping | Housekeeping manage. |

## Debug Checklist

- Confirm staff resource returns users for the active hotel.
- Confirm housekeeping resource returns task records.
- Confirm rooms and staff are loaded before diagnosing housekeeping assignment UI.
- Confirm current user has `department_id` when hierarchy needs department context.
- Confirm staff profile action is allowed.
- Confirm pull-to-refresh targets staff or housekeeping as expected.

## Test Checklist

- Staff screen renders list and empty state.
- Staff profile opens only with permission.
- Housekeeping screen renders with tasks, rooms, and staff.
- Housekeeping still renders when one supporting resource is empty.
- Hierarchy screen handles missing department gracefully.
