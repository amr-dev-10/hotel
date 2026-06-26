# Current Development Operations Guide

This document records the current implemented flows for escalation, notification, Food and Beverage, and the guest portal.

## Frontend Access

- Hotel dashboard: `http://localhost:3000/<hotelId>/overview`
- Escalations: `http://localhost:3000/<hotelId>/escalations`
- Food and Beverage: `http://localhost:3000/<hotelId>/fnb`
- Kitchen board: `http://localhost:3000/<hotelId>/kitchen`
- Guest portal: `http://localhost:3000/guest`
- Guest portal token link: `http://localhost:3000/guest?token=<guestPortalToken>`

The dashboard sidebar includes Escalations, F&B, and Kitchen in the Operations navigation. The notification bell and ticket dispatch alert are mounted in the shared dashboard shell, so staff see them across hotel admin pages after login.

## Escalation Development

Escalation is connected to the ticket dispatch and SLA flow.

Backend implementation:

- Ticket list and escalation endpoints live in `backend/app/api/v1/tickets.py`.
- Escalated ticket list: `GET /api/v1/hotels/{hotel_id}/tickets/escalations?scope=all|department|mine`.
- Per-ticket escalation timeline: `GET /api/v1/hotels/{hotel_id}/tickets/{ticket_id}/escalations`.
- Dispatch logic lives in `backend/app/services/dispatch_service.py`.
- SLA escalation checks live in `backend/app/services/escalation_service.py`.
- Escalation logs are read through `EscalationLogRepository.list_for_hotel`.

Frontend implementation:

- Page route: `apps/dashboard/src/app/(dashboard)/[hotelId]/escalations/page.tsx`.
- Page UI: `apps/dashboard/src/features/escalations/components/escalations-page.tsx`.
- Query hook: `apps/dashboard/src/features/escalations/hooks/useEscalations.ts`.

Functional flow:

1. A ticket is created from staff, WhatsApp, guest portal, room service, or another source.
2. `TicketService` dispatches the ticket through `DispatchService`.
3. Eligible staff are selected by department, staff level, duty status, and current open-ticket load.
4. Staff receive a ticket acceptance offer and websocket notification.
5. If a staff member accepts, the ticket moves to `accepted`, the assignee is fixed, and SLA due time starts.
6. If all offers are rejected or the acceptance timer expires, dispatch checks the matching escalation rule.
7. A new escalation log is created and the ticket is offered to the next configured staff level.
8. Admin users can view all escalation logs. Staff users can view department or personal escalations.

## Notification Development

Notifications are persisted and broadcast in realtime.

Backend implementation:

- Notification CRUD and read status live in `backend/app/api/v1/ops.py`.
- Notification persistence lives in `backend/app/services/ops_service.py`.
- Websocket publishing lives in `backend/app/services/notification_service.py`.
- Dispatch notifications include `notification_type`, `reference_id`, and metadata so the frontend can route the user to the right ticket or conversation.

Frontend implementation:

- Notification bell: `apps/dashboard/src/components/notification-bell.tsx`.
- Dispatch alert: `apps/dashboard/src/components/dispatch-alert.tsx`.
- Notification store: `apps/dashboard/src/stores/notification.store.ts`.
- Websocket hook: `apps/dashboard/src/hooks/useWebSocket.ts`.

Functional flow:

1. Backend creates a notification row through `NotificationCenterService`.
2. The realtime service publishes the payload to the user or hotel websocket channel.
3. The dashboard websocket hook receives the event and updates the notification store.
4. `NotificationBell` shows unread notification count and lets staff open or mark notifications read.
5. Dispatch notifications also show a bottom alert with accept and reject actions.
6. Accept moves the ticket to the accepting staff user. Reject stores the rejection reason and may trigger escalation if no pending offers remain.

## Food and Beverage Development

The F&B dashboard is a combined menu management, tax management, and order operations surface.

Frontend access:

- Main F&B page: `/<hotelId>/fnb`
- Kitchen board: `/<hotelId>/kitchen`

Backend implementation:

- Menu category and item APIs: `backend/app/api/v1/menu.py`.
- Tax APIs: `backend/app/api/v1/folios.py`.
- Restaurant table and order APIs: `backend/app/api/v1/restaurant.py`.
- Restaurant business logic: `backend/app/services/restaurant_service.py`.
- Order websocket route: `backend/app/api/ws/routes.py`.

Frontend implementation:

- F&B page UI: `apps/dashboard/src/features/fnb/components/fnb-page.tsx`.
- F&B hooks: `apps/dashboard/src/features/fnb/hooks/useFnb.ts`.
- Kitchen UI: `apps/dashboard/src/features/kitchen/components/kitchen-page.tsx`.

Menu flow:

1. Open `/<hotelId>/fnb`.
2. Use the top action bar to create Food Item, Beverage, Category, or Tax.
3. Use filters for search, category, availability, price, tax, status, and sort.
4. Use the left category tree to filter categories or open category actions.
5. Use menu cards to edit, duplicate, delete, or toggle item availability.
6. The item drawer edits image URL, name, description, category, price, taxes, availability, preparation time, display order, and dietary tags.
7. Import Menu reads CSV rows and creates items. Export Menu downloads the current menu as CSV.

Tax flow:

1. Open the Taxes tab on `/<hotelId>/fnb`.
2. Create or edit tax rules with name, description, type, value, applies-to, and active status.
3. Assign tax rules to menu items from the item drawer.
4. Restaurant order totals calculate item tax from assigned item taxes. If no item tax is assigned, active food tax rules are used.

Order flow:

1. Guest portal, WhatsApp room service, or staff POS/manual action creates a restaurant order.
2. The order is saved with source, guest/room/table/folio links, items, subtotal, tax, total, status, and instructions.
3. Orders appear in the F&B Orders tab grouped by Pending, Preparing, Ready, Delivered, and Cancelled.
4. Staff can create a manual order using Staff Order from the F&B action bar or Orders tab, with room and guest selectors plus table, folio, and instruction fields.
5. Staff can edit an existing order from the order card. An in-page order form loads order detail, lets staff change order metadata, status, instructions, and line items, then sends a PATCH update.
6. Status buttons move orders through Accept, Preparing, Ready, and Delivered.
7. Kitchen staff can use `/<hotelId>/kitchen` for the same order status workflow with realtime refresh.

Staff manual order and edit endpoints:

- Create manual order: `POST /api/v1/hotels/{hotel_id}/restaurant/orders`.
- Get order detail: `GET /api/v1/hotels/{hotel_id}/restaurant/orders/{order_id}`.
- Edit order: `PATCH /api/v1/hotels/{hotel_id}/restaurant/orders/{order_id}`.
- Update status only: `PATCH /api/v1/hotels/{hotel_id}/restaurant/orders/{order_id}/status`.

Edit behavior:

- Staff can update source, guest ID, room ID, table ID, ticket ID, folio ID, instructions, status, and line items.
- If line items are changed, subtotal, tax, and total are recalculated.
- If an order is linked to a folio, the folio ID is validated. Existing posted folio lines are not automatically rewritten by the edit endpoint.
- Every edit writes an audit event and publishes a restaurant order websocket event.

## Guest Portal Development

The guest portal is a guest-facing web flow for stay verification, food ordering, order tracking, and service requests.

Frontend implementation:

- Guest login: `/guest`
- Guest menu: `/guest/menu`
- Guest cart: `/guest/cart`
- Guest orders: `/guest/orders`
- Guest requests: `/guest/requests`
- Guest shell and pages live in `apps/dashboard/src/features/guest-portal`.
- Guest session store: `apps/dashboard/src/stores/guest-session.store.ts`.
- Guest cart store: `apps/dashboard/src/stores/guest-cart.store.ts`.

Backend implementation:

- Guest portal routes live in `backend/app/api/v1/guest_portal.py`.
- Guest session validation lives in `backend/app/api/guest_dependencies.py`.
- Guest portal service lives in `backend/app/services/guest_portal_service.py`.

How to use the guest portal:

1. Open `/guest`.
2. Verify a stay either by token link or by entering hotel ID, phone or WhatsApp number, and room number.
3. After login, the guest session token is stored in the frontend guest session store.
4. Open Menu to browse active menu categories and available menu items.
5. Add food or beverages to the cart and place an order.
6. Open Orders to track food order status.
7. Open Requests to create service tickets such as housekeeping, maintenance, or other guest needs.

Guest portal API flow:

- Login with stay details: `POST /api/v1/guest-portal/auth/login`.
- Login with token: `POST /api/v1/guest-portal/auth/token`.
- Current guest profile: `GET /api/v1/guest-portal/profile`.
- Menu categories: `GET /api/v1/guest-portal/menu/categories`.
- Menu items: `GET /api/v1/guest-portal/menu/items?category_id=<categoryId>`.
- Place food order: `POST /api/v1/guest-portal/orders`.
- List guest orders: `GET /api/v1/guest-portal/orders`.
- Get guest order detail: `GET /api/v1/guest-portal/orders/{order_id}`.
- Create guest service request: `POST /api/v1/guest-portal/requests`.
- List guest service requests: `GET /api/v1/guest-portal/requests`.

Guest food order flow:

1. Guest places order from `/guest/cart`.
2. Backend creates a restaurant order with source `guest_portal`, current guest ID, current room ID, guest flag, instructions, and order items.
3. Restaurant service calculates totals and posts to an open guest folio when one is available.
4. Order appears in staff F&B Orders and Kitchen board.
5. Guest sees status updates from `/guest/orders`.

Guest request flow:

1. Guest submits a request from `/guest/requests`.
2. Backend creates a ticket with source `PORTAL`, the guest, reservation, room, department key, task category, description, and priority.
3. Ticket service routes the ticket through the normal dispatch flow.
4. Staff receive dispatch notifications and accept or reject the ticket.
5. Guest can refresh the Requests page to see submitted portal tickets.

## Operational Notes

- Backend should be run in Windows PowerShell with `.venv-win`.
- Dashboard should be run with `pnpm run dev:dashboard`.
- Redis can continue running from WSL as currently configured.
- Run migrations after pulling database changes: `alembic -c backend/alembic.ini upgrade head`.
- Current order statuses used by F&B and Kitchen are `received`, `preparing`, `ready`, `delivered`, and `cancelled`.
