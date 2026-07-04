# HoboERP Mobile Structure

This app follows a domain-first mobile structure for the Arcadia hotel platform.

## Top Level

- `app/` - mobile app composition and root screen wiring.
- `assets/` - images, icons, fonts, animations, lottie, and SVG assets.
- `components/` - shared UI and layout components with no business logic.
- `config/` - environment, API, feature flag, and tenant configuration.
- `constants/` - shared constants such as staging credentials for development.
- `modules/` - business domains such as auth, ticket, reservation, room, and food.
- `navigation/` - root navigation, linking, and future nested navigators.
- `permissions/` - RBAC helpers aligned with backend permission names.
- `services/` - infrastructure services such as API, storage, network, camera, uploads, and analytics.
- `store/` - global state only.
- `theme/` - Arcadia design tokens shared by screens and components.
- `types/` - shared API and domain types.
- `utils/` - pure helpers for date, currency, validation, files, and formatting.

## Module Shape

Each business module should use this shape as it grows:

```text
modules/<domain>/
  api/
  components/
  constants/
  hooks/
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
Screen -> Hook -> Service -> API -> Backend
```

Current examples:

- Operations loading: `app/ArcadiaMobileApp.tsx` -> `modules/operations/hooks/useOperationsWorkspace.ts`.
- Ticket actions: operations hook -> `modules/ticket/services/ticket.service.ts` -> `modules/ticket/api/ticket.api.ts`.
- F&B order actions: operations hook -> `modules/food/services/order.service.ts` -> `modules/food/api/order.api.ts`.
- Dashboard view data: app shell -> `modules/dashboard/services/dashboardData.service.ts`.

Use `services/logger` for application logs instead of scattering direct debug logging.
