# ADB Debugging

ADB is the Android Debug Bridge. Use it to inspect devices, logs, installs, and
port forwarding.

## Device Commands

```sh
adb devices
adb kill-server
adb start-server
adb reconnect
```

Expected `adb devices` output should show at least one device with state
`device`.

## Logcat

All logs:

```sh
adb logcat
```

Filter on Windows:

```powershell
adb logcat | findstr ReactNative
```

Filter on macOS/Linux:

```sh
adb logcat | grep ReactNative
```

## Port Forwarding

For local backend testing:

```sh
adb reverse tcp:8000 tcp:8000
```

For Metro when needed:

```sh
adb reverse tcp:8081 tcp:8081
```

List reverse rules:

```sh
adb reverse --list
```

## Install And Uninstall

Uninstall current app:

```sh
adb uninstall com.hoboerp
```

Install APK:

```sh
adb install path/to/app.apk
```

Reinstall APK:

```sh
adb install -r path/to/app.apk
```

## Device Shell

```sh
adb shell
```

Useful checks:

```sh
adb shell pm list packages | grep hoboerp
adb shell dumpsys package com.hoboerp
```

On Windows, use `findstr` instead of `grep`.

## Common Device Fixes

| Problem | Fix |
| --- | --- |
| Device unauthorized | Revoke USB debugging authorizations on phone, reconnect, accept prompt. |
| Device offline | Restart ADB server and reconnect USB. |
| App install fails because package exists | `adb uninstall com.hoboerp`, then reinstall. |
| App cannot reach local backend | Add `adb reverse tcp:8000 tcp:8000`. |
| Logs too noisy | Filter with `ReactNative`, app package, or known log tag. |
