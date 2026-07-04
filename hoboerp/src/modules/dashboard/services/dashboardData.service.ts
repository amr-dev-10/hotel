import type {ArcadiaRecord} from '../../../types/domain';
import type {ResourceKey, ResourceState} from '../../operations/types';
import type {AppData, ReservationView, TicketView} from '../types';

export function buildAppData(
  resources: Record<ResourceKey, ResourceState>,
): AppData {
  const reservationsSource = resources.reservations.items;
  const ticketsSource = resources.tickets.items;
  const rooms = resources.rooms.items;
  const roomsTotal = resources.rooms.total ?? rooms.length;
  const occupiedRooms = countStatus(rooms, 'occupied');
  const outOfOrderRooms = countStatus(rooms, 'out');
  const vacantRooms = Math.max(roomsTotal - occupiedRooms - outOfOrderRooms, 0);

  return {
    reservations: reservationsSource.slice(0, 12).map(toReservationView),
    tickets: ticketsSource.slice(0, 12).map(toTicketView),
    escalations: resources.escalations.items,
    notifications: resources.notifications.items,
    rooms,
    orders: resources.orders.items,
    staff: resources.staff.items,
    housekeeping: resources.housekeeping.items,
    whatsapp: resources.whatsapp.items,
    todayCheckIns: countStatus(reservationsSource, 'checked in'),
    todayCheckOuts: countStatus(reservationsSource, 'checked out'),
    roomsTotal,
    occupiedRooms,
    vacantRooms,
    outOfOrderRooms,
    occupancy: Math.round((occupiedRooms / Math.max(roomsTotal, 1)) * 100),
    openTickets:
      resources.tickets.total ??
      ticketsSource.filter(
        item => normalize(valueOf(item, 'stage', 'status')) !== 'completed',
      ).length,
  };
}

export function isScreenLoading(
  screen: string,
  resources: Record<ResourceKey, ResourceState>,
) {
  if (screen === 'reservations') {
    return resources.reservations.loading;
  }
  if (screen === 'tickets') {
    return resources.tickets.loading;
  }
  if (screen === 'escalations') {
    return resources.escalations.loading;
  }
  if (screen === 'notifications') {
    return resources.notifications.loading;
  }
  if (screen === 'room') {
    return resources.rooms.loading;
  }
  if (screen === 'food') {
    return resources.orders.loading;
  }
  if (screen === 'kitchen') {
    return resources.orders.loading;
  }
  if (screen === 'staff') {
    return resources.staff.loading;
  }
  if (screen === 'housekeeping') {
    return resources.housekeeping.loading;
  }
  if (screen === 'whatsapp') {
    return resources.whatsapp.loading;
  }
  return Object.values(resources).some(resource => resource.loading);
}

function toReservationView(item: ArcadiaRecord): ReservationView {
  return {
    id: valueOf(item, 'id', 'reservation_id', 'booking_id'),
    guestName: valueOf(item, 'guest_name', 'primary_guest_name', 'name'),
    roomNumber: valueOf(item, 'room_number', 'room'),
    bookingId: valueOf(item, 'booking_id', 'reservation_no', 'id'),
    stayDates:
      valueOf(item, 'stay_dates') ||
      compactRange(
        valueOf(item, 'check_in_date', 'checkin_date'),
        valueOf(item, 'check_out_date', 'checkout_date'),
      ),
    adults: Number(valueOf(item, 'adults', 'adult_count')) || 0,
    children: Number(valueOf(item, 'children', 'child_count')) || 0,
    status: valueOf(item, 'status'),
  };
}

function toTicketView(item: ArcadiaRecord): TicketView {
  return {
    id: valueOf(item, 'id', 'ticket_id', 'ticket_code'),
    code: valueOf(item, 'ticket_code', 'code', 'id'),
    title: valueOf(item, 'item_description', 'description', 'title'),
    roomNumber: valueOf(item, 'room_number', 'room'),
    guestName: valueOf(item, 'guest_name', 'guest'),
    department:
      valueOf(item, 'task_category_name', 'department', 'task_category'),
    createdAt: valueOf(item, 'created_at', 'created'),
    priority: valueOf(item, 'priority'),
    status: valueOf(item, 'stage', 'status'),
  };
}

function valueOf(item: ArcadiaRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }
  return '';
}

function countStatus(items: ArcadiaRecord[], status: string) {
  return items.filter(item =>
    normalize(valueOf(item, 'status')).includes(status),
  ).length;
}

function compactRange(start: string, end: string) {
  if (!start && !end) {
    return '';
  }
  return [start, end].filter(Boolean).join(' - ');
}

function normalize(value: string) {
  return value.toLowerCase().replaceAll('_', ' ');
}
