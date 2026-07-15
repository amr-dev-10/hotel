# State Management

HoboERP Mobile uses React Query for backend-backed server state and Zustand for
local client state.

## State Ownership

| State | Tool | Primary files |
| --- | --- | --- |
| Hotel resources from backend | React Query | `src/modules/operations/queries.ts`, `src/modules/operations/hooks/useOperationsWorkspace.ts` |
| Auth session and current user | Zustand + AsyncStorage | `src/store/authStore.ts`, `src/app/ArcadiaMobileApp.tsx` |
| Notifications, unread count, dispatch/escalation alerts | Zustand | `src/store/notificationStore.ts` |
| UI navigation state | Component state and Zustand | `src/app/ArcadiaMobileApp.tsx`, `src/store/uiStore.ts` |
| Query diagnostics | React Query cache subscription | `src/services/debug/queryDiagnostics.ts` |

## React Query Defaults

Defined in `src/app/queryClient.ts`:

| Option | Current value |
| --- | --- |
| Query stale time | 30 seconds |
| Query garbage collection | 5 minutes outside tests, infinite in tests |
| Query retry | 1 |
| Mutation retry | 0 |
| Refetch on mount | false |
| Refetch on reconnect | true |

The focus manager listens to React Native `AppState` so active app state can
influence query behavior.

## Operations Resource Cache

Operations resources are keyed like:

```ts
['operations', hotelId, resource]
```

Resources:

- `tickets`
- `escalations`
- `notifications`
- `guests`
- `reservations`
- `rooms`
- `orders`
- `staff`
- `housekeeping`
- `whatsapp`

The operations hook exposes:

- `resources`
- `loadResource(resource)`
- `loadAllResources(token, hotelId)`
- `resetWorkspace()`
- `handleAction(resource, item, action)`

## Auth Store

`useAuthStore` persists to AsyncStorage using the key
`hoboerp.auth.store.v1`.

Stored values include:

- `token`
- `refreshToken`
- `currentUser`
- `currentHotelId`
- `hotelName`
- `isRestoring`

The app shell also stores the full session under `hoboerp.session.v1`.

## Notification Store

`useNotificationStore` owns:

- Active dispatch alert.
- Active escalation alert.
- Connection state.
- Last toast notification.
- Notification list.
- Unread count.

Notification lists are capped to the latest 75 items.

## Recommended State Rules

- Put API data in React Query.
- Put UI-only values in local component state or `useUiStore`.
- Put global session and notification data in Zustand.
- Do not duplicate server records into Zustand unless there is a deliberate
  offline or optimistic workflow.
- Use `queryClient.setQueryData()` for targeted cache updates after successful
  workflow actions.
- Use `loadResource()` for pull-to-refresh and realtime refresh callbacks.
