# Metro Debugging

Metro is the JavaScript bundler used by React Native.

## Start Metro

```sh
cd hoboerp
npm start
```

Default port:

```text
8081
```

## Reset Metro Cache

```sh
npm start -- --reset-cache
```

Use this when:

- Old assets still appear.
- Module resolution behaves strangely.
- New files are not picked up.
- The bundle references stale code.

## Common Metro Issues

| Symptom | Fix |
| --- | --- |
| Cannot find module | Confirm dependency is installed and path casing matches. |
| Duplicate module/provider behavior | Stop all Metro processes and restart one server. |
| Asset not updating | Reset cache and reinstall app if needed. |
| Bundle stuck | Stop Metro, clear cache, rerun `npm run android`. |
| Port already in use | Kill the old Metro process or start on another port. |

## Reloading The App

Android:

- Press `R` twice in the Metro terminal.
- Or open the dev menu and choose reload.
- On Windows/Linux Android emulator, the dev menu is often `Ctrl+M`.

## Reading Logs

Watch the Metro terminal for:

- `console.log`, `console.warn`, `console.error`.
- `logger.*` output.
- React Query diagnostics when enabled.
- Redbox stack traces.

## Metro And Tests

Jest does not require Metro. If a Jest failure mentions React Native module
resolution, check:

- `jest.config.js`
- `jest.setup.js`
- `__mocks__/`
- Transform settings from the React Native preset.
