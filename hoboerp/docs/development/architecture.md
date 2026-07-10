# Architecture

HoboERP Mobile is a React Native app with a domain-first module structure. The
main app shell currently coordinates authentication, resource loading,
navigation state, realtime updates, modal orchestration, and Android back
handling.

## Runtime Layers

```mermaid
flowchart TD
  Native["Android/iOS native shell"] --> Entry["index.js and App.tsx"]
  Entry --> Root["src/navigation/RootNavigator.tsx"]
  Root --> Providers["src/app/AppProviders.tsx"]
  Providers --> Shell["src/app/ArcadiaMobileApp.tsx"]
  Shell --> Screens["ScreenContent and feature screens"]
  Screens --> Hooks["Feature hooks and operations hook"]
  Hooks --> Services["Domain services"]
  Services --> Api["apiRequest fetch wrapper"]
  Api --> Backend["Arcadia backend API"]
```

## Important Runtime Files

| File | Responsibility |
| --- | --- |
| `App.tsx` | React Native root export. |
| `src/navigation/RootNavigator.tsx` | Wraps the app in providers. |
| `src/app/AppProviders.tsx` | Installs React Query and development diagnostics. |
| `src/app/queryClient.ts` | Configures React Query defaults and app focus behavior. |
| `src/app/ArcadiaMobileApp.tsx` | Main shell: auth, session restore, navigation, resource refresh, modals. |
| `src/modules/operations/hooks/useOperationsWorkspace.ts` | Loads operational resources and handles ticket/order workflow actions. |
| `src/services/api/client.ts` | API request, JSON parsing, token header, refresh retry, error formatting. |
| `src/services/websocket/WebSocketClient.ts` | WebSocket connection and reconnect behavior. |
| `src/services/pushNotifications.ts` | Firebase messaging registration for escalation notifications. |

## Data Ownership

| Data type | Owner |
| --- | --- |
| Server records | React Query through domain queries/hooks. |
| Auth/session | `useAuthStore` plus AsyncStorage session persistence. |
| Notifications and realtime alerts | `useNotificationStore`. |
| Local UI state | Component state and `useUiStore` where used. |
| Theme tokens | `src/theme/`. |

## Application Flow

```mermaid
sequenceDiagram
  participant User
  participant App as ArcadiaMobileApp
  participant Storage as AsyncStorage
  participant API as apiRequest
  participant Query as React Query
  participant Backend

  App->>Storage: Read hoboerp.session.v1
  alt saved session exists
    App->>API: Load hotel profile
    App->>Query: Load operations resources
    Query->>Backend: GET hotel resource endpoints
  else no saved session
    User->>App: Submit login
    App->>API: POST /api/v1/auth/login
    API->>Backend: Login request
    App->>API: GET /api/v1/auth/me
    App->>Storage: Save session
    App->>Query: Load resources
  end
```

## Realtime Flow

```mermaid
flowchart LR
  Backend["Backend notification event"] --> WS["/ws/notifications"]
  WS --> Client["MobileWebSocketClient"]
  Client --> Store["notificationStore"]
  Client --> Refresh["Targeted resource refresh"]
  Refresh --> Query["React Query cache"]
  Query --> UI["ScreenContent"]
```

## Key Design Decisions

- The app uses React Query for backend-backed resource state.
- The operations workspace loads the shared hotel resources used by many
  screens.
- The app shell holds current screen, selected records, popup state, and session
  restoration behavior.
- Permissions are checked before screen navigation and protected actions.
- `apiRequest` retries once after a 401 when a refresh token is available.
- WebSocket reconnects with exponential backoff up to 30 seconds.

## Current Architecture Notes

- React Navigation packages are installed, but the active app shell uses local
  `ScreenKey` state rather than a full nested React Navigation tree.
- Release Android builds currently sign with the debug keystore and must be
  updated before production distribution.
- Offline queue support exists as a feature flag, but it is currently disabled.
