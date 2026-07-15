# Performance Debugging

Use this page when the app feels slow, screens stutter, large lists lag, or
network refreshes happen too often.

## First Checks

1. Is the app running in development mode? Development mode is slower.
2. Is Metro rebuilding repeatedly?
3. Are React Query requests refetching in a loop?
4. Is a large list rendered without virtualization?
5. Are images too large for the displayed size?
6. Are expensive mappings/calculations running on every render?
7. Are WebSocket events causing too many resource refreshes?

## React Query

Defaults:

- `staleTime`: 30 seconds.
- `retry`: 1.
- `refetchOnMount`: false.
- `refetchOnReconnect`: true.

Performance checks:

- Watch `[query:fetching]` logs.
- Confirm query keys are stable.
- Confirm components are not calling `loadResource()` during render.
- Use `queryClient.setQueryData()` for targeted updates after actions.
- Refresh only affected resources after WebSocket events.

## Rendering

Check:

- Expensive derived data should use `useMemo`.
- Handlers passed deep into components should use `useCallback` when they cause
  visible child rerenders.
- Large lists should use `FlatList` or another virtualized list.
- Avoid mapping hundreds of records into nested views at once.
- Keep screens thin and move transformations to services/view-model helpers.

## Images

Image performance checklist:

- Use appropriately sized PNG/JPG assets.
- Avoid oversized images for icons.
- Define width and height.
- Avoid re-requiring or rebuilding image sources in render loops.
- Test low-memory devices when adding image-heavy screens.

## WebSocket And Push

Realtime updates should refresh only the resource that changed. If performance
drops after notification events:

1. Inspect the event type.
2. Confirm the handler maps to a specific resource.
3. Avoid calling `loadAllResources()` for every event.
4. Watch repeated reconnects.

## Android Profiling

Useful tools:

- Android Studio Profiler.
- `adb logcat` for native warnings.
- React Native performance monitor.
- React DevTools where configured.

## Performance Regression Checklist

Before release:

- Login to dashboard feels responsive.
- Dashboard summary renders without visible delay after data is ready.
- Ticket list scrolls smoothly.
- WhatsApp conversation does not lag with realistic message counts.
- Pull-to-refresh does not trigger unrelated resources.
- Android back navigation remains immediate.
- No repeated query error loop appears in Metro.
