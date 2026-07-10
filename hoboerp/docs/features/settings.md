# Profile And Settings Feature

Profile/settings covers the current user, hotel context, logout, account actions,
and future notification preferences.

## Main Files

| File | Purpose |
| --- | --- |
| `src/modules/profile/README.md` | Module ownership note. |
| `src/modules/operations/screens/OperationsScreens.tsx` | Profile screen rendering. |
| `src/app/ArcadiaMobileApp.tsx` | Logout and profile option popup orchestration. |
| `src/store/authStore.ts` | Current user, hotel name, tokens. |
| `src/store/notificationStore.ts` | Notification state cleared on logout. |

## Screen Key

```text
profile
```

`ScreenContent` falls back to `ProfileScreen` when a screen key does not match
another explicit branch.

## Profile Inputs

Profile screen receives:

- `user`
- `hotelName`
- `onLogout`
- `onNavigate`
- `onOpenProfileOption`
- `onOpenNotifications`

## Logout Behavior

Logout:

1. Unregisters escalation push notifications when a session exists.
2. Clears local session state.
3. Clears auth store.
4. Clears notifications.
5. Removes `hoboerp.session.v1`.
6. Resets operations workspace.
7. Returns screen state to dashboard/login.

## Debug Checklist

- Confirm `hotelName` is loaded from `/api/v1/hotels/{hotelId}` or falls back
  to the hotel ID.
- Confirm auth store has current user and current hotel ID.
- Confirm logout removes both app-shell session and persisted auth store values.
- Confirm profile option popup uses the expected label.
- Confirm notification state clears on logout.

## Test Checklist

- Profile shows current user and hotel context.
- Logout returns to login.
- Re-login after logout loads fresh resources.
- Profile options open and close correctly.
- Notifications button opens notification screen.
