# Common Errors

Use this page as the shared troubleshooting table for recurring HoboERP Mobile
issues.

| Problem | Likely cause | Fix |
| --- | --- | --- |
| Metro not running | Dev server is stopped. | Run `npm start` from `hoboerp/`. |
| App cannot connect to local backend | Android device cannot reach host port. | Run `adb reverse tcp:8000 tcp:8000` or use a reachable host URL. |
| API returns 401 | Access token expired or invalid. | Confirm refresh token flow, then sign in again if refresh fails. |
| API returns 403 | Missing backend permission. | Check `/api/v1/auth/me`, role assignment, and `navigationGuard.ts`. |
| Screen hidden from drawer | User lacks screen permission. | Check `filterNavItemsForUser()` and `screenPermissionMap`. |
| Blank screen | Render error caught by error boundary or missing screen branch. | Check Metro stack trace and `ScreenContent`. |
| Data loads forever | Query is enabled but request never completes or endpoint fails. | Check `[query:error]` logs and backend response. |
| Pull-to-refresh does nothing | Wrong resource key or missing refresh callback. | Check `onRefresh`, `loadResource()`, and `resourceKeys`. |
| Image not visible | Wrong asset path or missing dimensions. | Verify asset path, `require()`, width, and height. |
| Push notifications not working | Missing Firebase config or registration failure. | Check `google-services.json`, Firebase project, and `pushNotifications.ts`. |
| WebSocket not updating UI | Socket disabled, auth rejected, or event unhandled. | Check `featureFlags.enableRealtimeSockets`, token, and WebSocket handlers. |
| Android device offline | ADB device state is stale. | Run `adb kill-server`, `adb start-server`, reconnect USB, then `adb devices`. |
| Build fails after dependency change | Native build cache is stale. | Run Gradle clean and reset Metro cache. |
| Release APK signed with debug key | Current Gradle release signing uses debug config. | Add production signing config before real distribution. |
| Type errors after OpenAPI update | Generated schema changed contracts. | Regenerate types and update module adapters/view models. |

## Reset Commands

Metro cache:

```sh
npm start -- --reset-cache
```

Android clean:

```sh
cd android
./gradlew clean
```

Windows:

```powershell
cd android
.\gradlew.bat clean
```

ADB reset:

```sh
adb kill-server
adb start-server
adb devices
```

## When Adding A New Error

Add:

- Symptom.
- Root cause.
- Exact fix command or file.
- How to prevent it in the future.
