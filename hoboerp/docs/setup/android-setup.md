# Android Setup

HoboERP Mobile is currently Android-first.

## Android Project Facts

| Setting | Value |
| --- | --- |
| Namespace | `com.hoboerp` |
| Application ID | `com.hoboerp` |
| Minimum SDK | 24 |
| Target SDK | 36 |
| Compile SDK | 36 |
| Build tools | 36.0.0 |
| Kotlin | 2.1.20 |
| NDK | 27.1.12297006 |
| App version code | 1 |
| App version name | 1.0 |

Main files:

- `android/build.gradle`
- `android/app/build.gradle`
- `android/settings.gradle`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/java/com/hoboerp/MainActivity.kt`
- `android/app/src/main/java/com/hoboerp/MainApplication.kt`

## Android Studio Setup

Install the following from Android Studio SDK Manager:

- Android SDK Platform 36
- Android SDK Build-Tools 36.0.0
- Android SDK Platform-Tools
- Android Emulator
- A device image matching the team target

Make sure `ANDROID_HOME` or `ANDROID_SDK_ROOT` points to the Android SDK.

## Running On Emulator

```sh
cd hoboerp
npm start
```

In another terminal:

```sh
cd hoboerp
npm run android
```

## Running On Physical Device

1. Enable Developer Options on the Android device.
2. Enable USB debugging.
3. Connect the device by USB.
4. Verify it appears:

```sh
adb devices
```

5. Run the app:

```sh
npm run android
```

## Firebase Messaging

`android/app/build.gradle` applies the Google Services plugin only when
`android/app/google-services.json` exists:

```gradle
if (file("google-services.json").exists()) {
    apply plugin: "com.google.gms.google-services"
}
```

If push notifications are being tested, confirm that the correct
`google-services.json` file is present for the target Firebase project.

## Local Backend Port Forwarding

The checked-in mobile API points to staging. If a developer temporarily points
the app at a local backend on the machine, use ADB reverse for Android devices:

```sh
adb reverse tcp:8000 tcp:8000
```

Use emulator/device browser or `curl` from the host to verify the backend first.

## Clean Native Build

```sh
cd hoboerp/android
./gradlew clean
```

On Windows PowerShell:

```powershell
cd hoboerp\android
.\gradlew.bat clean
```
