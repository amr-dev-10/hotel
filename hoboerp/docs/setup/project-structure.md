# Project Structure

HoboERP Mobile uses a domain-first structure under `src/`.

```text
hoboerp/
  android/
  ios/
  maestro/
  scripts/
  src/
    app/
    assets/
    components/
    config/
    constants/
    modules/
    navigation/
    permissions/
    services/
    store/
    theme/
    types/
    utils/
```

## Top-Level Folders

| Folder | Responsibility |
| --- | --- |
| `android/` | Android native project, Gradle config, app manifest, Kotlin entrypoints. |
| `ios/` | iOS native project scaffolding. |
| `maestro/` | End-to-end mobile test flows. |
| `scripts/` | Utility scripts such as OpenAPI schema download. |
| `src/` | TypeScript application source. |

## `src/` Folders

| Folder | Responsibility |
| --- | --- |
| `app/` | App composition, providers, React Query client, app shell. |
| `assets/` | Images and icons, including HOBO splash assets. |
| `components/` | Shared UI components with no domain ownership. |
| `config/` | API URL, environment, feature flags. |
| `constants/` | Shared constants such as demo credentials. |
| `modules/` | Business domains and feature-specific code. |
| `navigation/` | Screen keys, nav item definitions, linking, root navigator. |
| `permissions/` | RBAC permission codes, guards, and permission gates. |
| `services/` | Infrastructure services: API, session, WebSocket, logging, debug, push. |
| `store/` | Zustand stores for local app state. |
| `theme/` | Design tokens and shared styles. |
| `types/` | Shared domain and API types, generated OpenAPI types. |
| `utils/` | Pure utility helpers. |

## Module Shape

Use this shape for growing modules:

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

Not every module has every folder yet. Add folders only when the module needs
them.

## Current Modules

| Module | Purpose |
| --- | --- |
| `assistant` | AI assistant screens, prompts, summaries, and service integrations. |
| `auth` | Login, profile loading, auth APIs. |
| `dashboard` | Display-ready app data and summary view models. |
| `escalation` | Escalation utilities, hooks, alert modal. |
| `food` | F&B order APIs and order workflow services. |
| `housekeeping` | Housekeeping task and room cleaning workflows. |
| `operations` | Shared operational resource loading and workflow actions. |
| `profile` | Profile, settings, notification preference, account actions. |
| `reservation` | Booking lists, detail, check-in/check-out flows. |
| `room` | Room inventory, room detail, room status transitions. |
| `ticket` | Ticket APIs, workflow actions, dispatch modal. |
| `whatsapp` | WhatsApp CRM conversations, templates, routing. |

## Ownership Rules

- Keep business behavior inside the owning module.
- Put shared UI in `components/`.
- Put infrastructure in `services/`.
- Put global client state in `store/`.
- Put backend-backed cache in React Query, not in Zustand.
- Put app-wide design tokens in `theme/`.
- Put generated OpenAPI types in `types/generated/`.
