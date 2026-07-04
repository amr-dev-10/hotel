export type ReservationView = {
  id: string;
  guestName: string;
  roomNumber: string;
  bookingId: string;
  stayDates: string;
  adults: number;
  children: number;
  status: string;
};

export type TicketView = {
  id: string;
  code: string;
  title: string;
  roomNumber: string;
  guestName: string;
  department: string;
  createdAt: string;
  priority: string;
  status: string;
};

export type AppData = {
  reservations: ReservationView[];
  tickets: TicketView[];
  escalations: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
  guests: Record<string, unknown>[];
  rooms: Record<string, unknown>[];
  orders: Record<string, unknown>[];
  staff: Record<string, unknown>[];
  housekeeping: Record<string, unknown>[];
  whatsapp: Record<string, unknown>[];
  todayCheckIns: number;
  todayCheckOuts: number;
  roomsTotal: number;
  occupiedRooms: number;
  vacantRooms: number;
  outOfOrderRooms: number;
  occupancy: number;
  openTickets: number;
};
