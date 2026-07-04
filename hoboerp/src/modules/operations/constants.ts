import type {ResourceKey, ResourceNavItem, ResourceState} from './types';

export const resourceLabels: Record<ResourceKey, string> = {
  tickets: 'Tickets',
  escalations: 'Escalations',
  notifications: 'Notifications',
  reservations: 'Reservations',
  rooms: 'Rooms',
  orders: 'F&B Orders',
  staff: 'Staff',
  housekeeping: 'Housekeeping',
  whatsapp: 'WhatsApp',
};

export const resourceNavItems: ResourceNavItem[] = [
  {key: 'tickets', label: 'Tickets', helper: 'Requests', icon: 'T'},
  {key: 'escalations', label: 'Escalations', helper: 'Priority', icon: 'E'},
  {key: 'notifications', label: 'Notifications', helper: 'Alerts', icon: 'N'},
  {key: 'reservations', label: 'Reservations', helper: 'Bookings', icon: 'R'},
  {key: 'rooms', label: 'Rooms', helper: 'Inventory', icon: 'B'},
  {key: 'orders', label: 'F&B', helper: 'Orders', icon: 'F'},
  {key: 'staff', label: 'Staff', helper: 'Shifts', icon: 'S'},
  {key: 'housekeeping', label: 'Housekeeping', helper: 'Tasks', icon: 'H'},
  {key: 'whatsapp', label: 'WhatsApp', helper: 'Chats', icon: 'W'},
];

export const resourcePaths: Record<ResourceKey, (hotelId: string) => string> = {
  tickets: hotelId => `/api/v1/hotels/${hotelId}/tickets?limit=20`,
  escalations: hotelId => `/api/v1/hotels/${hotelId}/escalations?limit=20`,
  notifications: hotelId => `/api/v1/hotels/${hotelId}/notifications?limit=20`,
  reservations: hotelId => `/api/v1/hotels/${hotelId}/reservations?limit=20`,
  rooms: hotelId => `/api/v1/hotels/${hotelId}/rooms?limit=40`,
  orders: hotelId => `/api/v1/hotels/${hotelId}/restaurant/orders?limit=20`,
  staff: hotelId => `/api/v1/hotels/${hotelId}/staff?limit=20`,
  housekeeping: hotelId => `/api/v1/hotels/${hotelId}/housekeeping/tasks?limit=20`,
  whatsapp: hotelId => `/api/v1/hotels/${hotelId}/whatsapp/conversations?limit=20`,
};

export const initialResources: Record<ResourceKey, ResourceState> = {
  tickets: {loading: false, error: null, items: []},
  escalations: {loading: false, error: null, items: []},
  notifications: {loading: false, error: null, items: []},
  reservations: {loading: false, error: null, items: []},
  rooms: {loading: false, error: null, items: []},
  orders: {loading: false, error: null, items: []},
  staff: {loading: false, error: null, items: []},
  housekeeping: {loading: false, error: null, items: []},
  whatsapp: {loading: false, error: null, items: []},
};
