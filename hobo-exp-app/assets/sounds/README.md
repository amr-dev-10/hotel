# Task alert ringtone

Place a loopable ringtone at `ringtone.mp3` in this folder.

**Spec**

- Format: MP3 (Android channel sound also expects mp3/wav)
- Length: 1–5 seconds, loopable (no leading/trailing silence — it loops in `expo-audio`)
- Loud, ringtone-style — this fires when a new task is assigned to an attendant.

**Where it's used**

- `src/services/taskAlert.ts` plays it in foreground via `expo-audio`.
- Android local notification channel `tasks-high` (set in `src/services/notifications.ts`) references the same file via `expo-notifications` config for in-app alerts. To wire that, add to `app.json`:

```json
{
  "expo": {
    "plugins": [
      ["expo-notifications", { "sounds": ["./assets/sounds/ringtone.mp3"] }]
    ]
  }
}
```

After dropping the file in, run `npx expo prebuild` (or just `expo start --clear` for managed workflow) so the bundler picks it up.
