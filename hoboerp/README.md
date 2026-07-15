# HoboERP Mobile

HoboERP Mobile is the React Native application for hotel operations in the
Arcadia platform. It supports hotel staff workflows for authentication,
dashboard monitoring, tickets, escalations, guests, reservations, rooms, F&B,
kitchen orders, housekeeping, staff, hierarchy, WhatsApp conversations, and
notifications.

The app currently targets Android first and includes iOS project scaffolding for
future use.

## Quick Start

```sh
npm install
npm start
npm run android
```

Run commands from the `hoboerp/` directory.

## Core Stack

| Area | Technology |
| --- | --- |
| App framework | React Native 0.86.0 |
| Language | TypeScript |
| React | 19.2.3 |
| Server state | TanStack React Query |
| Client state | Zustand |
| Navigation | Local app-shell navigation with React Navigation dependencies available |
| API transport | Fetch wrapper in `src/services/api/client.ts` |
| Realtime | WebSocket notifications |
| Push | Firebase Cloud Messaging |
| Tests | Jest, React Native Testing Library, Maestro |
| Package manager | npm |

## Main Documentation

Start here:

- [Documentation home](docs/README.md)
- [Development environment](docs/setup/development-environment.md)
- [Project structure](docs/setup/project-structure.md)
- [Architecture](docs/development/architecture.md)
- [Debugging guide](docs/debugging/debugging-guide.md)
- [Release build](docs/build/release-build.md)
- [Feature map](docs/features/README.md)

## Common Commands

| Task | Command |
| --- | --- |
| Start Metro | `npm start` |
| Run Android | `npm run android` |
| Run iOS | `npm run ios` |
| Run unit tests | `npm run test:unit` |
| Run all Jest tests | `npm test` |
| Run E2E flows | `npm run test:e2e` |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Generate API types from live backend | `npm run api:types:live` |

## Backend Target

The mobile app points to the staging backend:

```ts
API_BASE_URL = 'https://arcadia-backend-staging-v3dj3lwhfa-em.a.run.app'
```

The value is defined in `src/config/api.ts`.

## Android Build Facts

| Setting | Value |
| --- | --- |
| Package/application ID | `com.hoboerp` |
| Minimum SDK | 24 |
| Target SDK | 36 |
| Compile SDK | 36 |
| Build tools | 36.0.0 |
| Version code | 1 |
| Version name | 1.0 |

Release builds currently use the debug signing config in
`android/app/build.gradle`. Create a production keystore before distributing a
real release.

## Documentation Policy

When adding or changing a feature, update the nearest document in `docs/`.
Prefer short, practical notes that answer:

- Where is the feature located?
- What APIs does it use?
- How is state loaded and refreshed?
- How do developers debug it?
- What should be tested before release?
