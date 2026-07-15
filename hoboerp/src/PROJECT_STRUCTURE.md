# HoboERP Mobile Structure

This app follows a domain-first mobile structure for the Arcadia hotel platform.

## Top Level

- `app/` - mobile app composition, providers, and root screen wiring.
- `assets/` - images, icons, fonts, animations, lottie, and SVG assets.
- `components/` - shared UI and layout components with no business logic.
- `config/` - environment, API, feature flag, and tenant configuration.
- `constants/` - shared constants such as staging credentials for development.
- `modules/` - business domains such as auth, ticket, reservation, room, and food.
- `navigation/` - root navigation, linking, and future nested navigators.
- `permissions/` - RBAC helpers aligned with backend permission names.
- `services/` - infrastructure services such as API, debug diagnostics, storage, network, camera, uploads, and analytics.
- `store/` - global client state only. Do not store server API cache here.
- `theme/` - Arcadia design tokens shared by screens and components.
- `types/` - shared API, generated OpenAPI, and domain types.
- `utils/` - pure helpers for date, currency, validation, files, and formatting.

## Module Shape

Each business module should use this shape as it grows:

```text
modules/<domain>/
  api/
  components/
  constants/
  hooks/
  queries/
  screens/
  services/
  store/
  types/
  utils/
  validation/
  index.ts
  README.md
```

Keep module-specific behavior inside its module. Shared infrastructure belongs in `services/`, shared UI belongs in `components/`, and shared tokens belong in `theme/`.

## Data Flow

Screens should stay thin and route behavior through the module chain:

```text
Screen -> Hook/Query -> Service -> API -> Backend
```

Current examples:

- Operations loading: `app/ArcadiaMobileApp.tsx` -> `modules/operations/hooks/useOperationsWorkspace.ts` -> React Query -> `modules/operations/queries.ts`.
- Ticket actions: operations hook -> `modules/ticket/services/ticket.service.ts` -> `modules/ticket/api/ticket.api.ts`.
- F&B order actions: operations hook -> `modules/food/services/order.service.ts` -> `modules/food/api/order.api.ts`.
- Dashboard view data: app shell -> `modules/dashboard/services/dashboardData.service.ts`.

## Server State

Use React Query for backend-backed state. Keep query keys and query functions near the owning domain, such as `modules/operations/queries.ts`, and keep Zustand for local client state such as auth, notifications, UI, and optimistic workflow state.

`app/AppProviders.tsx` installs the shared `QueryClientProvider`. `app/queryClient.ts` defines default cache, retry, and React Native app-focus behavior. Pull-to-refresh and realtime callbacks should call a domain hook such as `loadResource`, which delegates to React Query instead of manually maintaining loading/error/cache objects.

## API Types

The FastAPI backend exposes `/openapi.json`. With the backend running locally, generate mobile API types from `hoboerp/`:

```sh
npm run api:types:live
```

This writes the downloaded schema and generated TypeScript into `types/generated/`. Prefer generated endpoint and payload types for new API modules, then adapt them into domain view models close to the module that owns the feature.

## Debugging

Use `services/logger` for application logs instead of scattering direct debug logging. Development query diagnostics are wired through `services/debug` and controlled by `featureFlags.enableQueryDiagnostics`, which makes query fetch/error events visible in the local log stream without changing screen code.

## Tests

Keep unit and integration tests beside the feature they verify, for example `modules/ticket/hooks/useTicket.test.ts` next to `useTicket.ts`. The root render smoke test lives next to `navigation/RootNavigator.tsx` so the remaining root folder stays app-shell only.
