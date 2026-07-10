# iOS Setup

The repository contains an iOS project, but the current practical target is
Android. Treat iOS as future-ready scaffolding until the team confirms active
iOS support.

## Existing iOS Files

| Path | Purpose |
| --- | --- |
| `ios/Podfile` | CocoaPods dependency configuration. |
| `ios/hoboerp/AppDelegate.swift` | Native app entry point. |
| `ios/hoboerp/Info.plist` | iOS app metadata and permissions. |
| `ios/hoboerp/LaunchScreen.storyboard` | Launch screen. |
| `ios/hoboerp.xcodeproj/` | Xcode project. |

## Setup Steps On macOS

```sh
cd hoboerp
bundle install
cd ios
bundle exec pod install
cd ..
npm run ios
```

## Before Considering iOS Production Ready

Confirm the following:

- Bundle identifier and signing team are correct.
- Firebase iOS configuration is available if push messaging is required.
- App icons and launch screen meet brand requirements.
- Native permissions in `Info.plist` match actual app behavior.
- All critical Android workflows have equivalent iOS QA coverage.
- Release build and TestFlight upload are documented.

## Current Status

Do not assume iOS is release-ready just because the project exists. Use this
page as the starting checklist for future iOS enablement.
