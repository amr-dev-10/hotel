# Development Environment

Use this page to set up a workstation for HoboERP Mobile development.

## Required Tools

| Tool | Required purpose |
| --- | --- |
| Node.js | JavaScript runtime. `package.json` requires `>= 22.11.0`. |
| npm | Package manager used by the project lockfile and scripts. |
| Android Studio | Android SDK, emulator, platform tools, Gradle integration. |
| JDK | Required by Android Gradle builds. Use the version recommended by the installed React Native/Android Gradle toolchain. |
| Git | Source control. |
| Watchman | Optional on Windows, commonly used on macOS/Linux for Metro file watching. |
| Maestro | Optional, required only for `npm run test:e2e`. |

## Install Dependencies

```sh
cd hoboerp
npm install
```

The repository includes `package-lock.json`, so use npm unless the team
intentionally migrates package managers.

## Environment Values

Current environment files are checked in:

| File | Purpose |
| --- | --- |
| `src/config/env.ts` | Declares `ENVIRONMENT = 'staging'`. |
| `src/config/api.ts` | Declares the staging API base URL and `/api/v1` prefix. |
| `src/config/featureFlags.ts` | Controls staging prefill, realtime sockets, offline queue, and query diagnostics. |

The current API target is:

```text
https://arcadia-backend-staging-v3dj3lwhfa-em.a.run.app
```

## First Run

Open one terminal for Metro:

```sh
cd hoboerp
npm start
```

Open a second terminal for Android:

```sh
cd hoboerp
npm run android
```

## Verification Commands

Run these after setup or before submitting a change:

```sh
npm run typecheck
npm run lint
npm run test:unit
```

Run E2E flows only when Maestro is installed and an emulator/device is ready:

```sh
npm run test:e2e
```

## OpenAPI Type Generation

The mobile app can generate API types from the backend OpenAPI schema.

```sh
npm run api:types:live
```

This runs:

1. Download `http://127.0.0.1:8000/openapi.json` into `src/types/generated/openapi.json`.
2. Generate TypeScript types into `src/types/generated/openapi.ts`.

Start the backend locally before using the live type command.

## Useful Development Files

| File | Use |
| --- | --- |
| `src/PROJECT_STRUCTURE.md` | Domain-first structure guidelines. |
| `src/app/ArcadiaMobileApp.tsx` | Main app shell, auth flow, navigation state, modals, resource refresh. |
| `src/app/AppProviders.tsx` | Installs React Query provider and diagnostics. |
| `src/services/api/client.ts` | API request wrapper and auth refresh retry. |
| `src/modules/operations/hooks/useOperationsWorkspace.ts` | Shared resource loading and workflow action handling. |
| `src/navigation/navigationConfig.ts` | Side drawer and bottom tab definitions. |
| `src/permissions/navigationGuard.ts` | Screen and action permission checks. |
