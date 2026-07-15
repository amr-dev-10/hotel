# Guests, Reservations, And Rooms

These features form the hotel stay context used by tickets, WhatsApp,
housekeeping, and dashboard metrics.

## Main Files

| Area | Main files |
| --- | --- |
| Guests | `src/modules/operations/screens/OperationsScreens.tsx`, `DetailScreens.tsx` |
| Reservations | `src/modules/reservation/`, operations screens, detail screens |
| Rooms | `src/modules/room/`, room screens and room popup |
| Data mapping | `src/modules/dashboard/services/dashboardData.service.ts` |
| Shared loading | `src/modules/operations/hooks/useOperationsWorkspace.ts` |

## Endpoints

| Resource | Endpoint |
| --- | --- |
| Guests | `/api/v1/hotels/{hotelId}/guests?limit=50` |
| Reservations | `/api/v1/hotels/{hotelId}/reservations?limit=20` |
| Rooms | `/api/v1/hotels/{hotelId}/rooms?limit=40` |

## Screen Keys

| Feature | Screen keys |
| --- | --- |
| Guests | `guests`, `guestDetail` |
| Reservations | `reservations`, `reservationDetail` |
| Rooms | `room` |

## Context Ticket Creation

Tickets can be created from:

- Reservation detail.
- Guest detail.
- WhatsApp conversation.
- Main create action.

Context is passed through selected record state in `ArcadiaMobileApp.tsx`.

## Reservation View Model

`toReservationView()` maps raw records into:

- `id`
- `guestName`
- `roomNumber`
- `bookingId`
- `stayDates`
- `adults`
- `children`
- `status`
- `raw`

## Room Metrics

Dashboard room metrics are derived from room status:

- Occupied rooms.
- Vacant rooms.
- Out-of-order rooms.
- Occupancy percentage.

## Permissions

| Area | Permission group |
| --- | --- |
| Guests | Guest view or guest basic view. |
| Reservations | Reservation view, reservation create for create action. |
| Rooms | Room view, room create/update for room form actions. |

## Debug Checklist

- Confirm selected guest/reservation is set before opening detail screens.
- Confirm room records include status values expected by dashboard metrics.
- Confirm reservation records include check-in/check-out or `stay_dates`.
- Confirm permissions allow the screen and action.
- Confirm contextual ticket creation receives the selected record.
- Confirm pull-to-refresh targets the correct resource.

## Test Checklist

- Guest list and guest detail render.
- Reservation list and detail render.
- Room list renders occupied/vacant/out-of-order states.
- Create reservation action is permission-gated.
- Create/update room action is permission-gated.
- Contextual ticket creation works from guest and reservation details.
