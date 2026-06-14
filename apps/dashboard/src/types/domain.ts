export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown> | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string | null;
  token_type: "bearer";
  expires_in_minutes: number;
}

export interface CurrentUser {
  id: string;
  hotel_id: string;
  department_id: string | null;
  name: string;
  email: string;
  job_role: string | null;
  is_hotel_owner: boolean;
  is_on_duty: boolean;
}

export interface Ticket {
  id: string;
  ticket_code: string;
  hotel_id: string;
  guest_id: string | null;
  room_id: string | null;
  department_id: string | null;
  assigned_to: string | null;
  stage: string;
  type: string;
  task_category: string | null;
  item_description: string;
  source: string;
  priority: number;
  sla_due_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketAcceptance {
  id: string;
  ticket_id: string;
  offered_to: string;
  offered_at: string;
  response: string;
  responded_at: string | null;
  auto_expired: boolean;
  expire_after_minutes: number;
}

export interface EscalationLog {
  id: string;
  hotel_id: string;
  ticket_id: string;
  from_user_id: string | null;
  to_user_id: string | null;
  reason: string;
  level: number;
  created_at: string;
}

export interface Reservation {
  id: string;
  hotel_id: string;
  reservation_no: string;
  guest_id: string;
  room_id: string | null;
  rate_plan_id: string | null;
  status: string;
  checkin_date: string;
  checkout_date: string;
  source: string;
  notes: string | null;
}

export interface Room {
  id: string;
  hotel_id: string;
  room_type_id: string | null;
  room_number: string;
  room_type: string | null;
  floor: string | null;
  status: string;
  notes: string | null;
}

export interface HousekeepingTask {
  id: string;
  hotel_id: string;
  room_id: string;
  assigned_to: string | null;
  task_type: string;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
  priority: number;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface StaffUser {
  id: string;
  hotel_id: string;
  department_id: string | null;
  reports_to?: string | null;
  staff_level?: string | null;
  name: string;
  email: string;
  job_role: string | null;
  is_hotel_owner: boolean;
  is_active: boolean;
  is_on_duty: boolean;
}

export interface AnalyticsSnapshot {
  id: string;
  hotel_id: string;
  snapshot_date: string;
  occupancy_rate: number;
  total_rooms: number;
  occupied_rooms: number;
  total_reservations: number;
  new_checkins: number;
  checkouts: number;
  ticket_count: number;
  avg_resolution_minutes: number;
  guest_satisfaction_avg: number;
  revenue_room: number;
  revenue_food: number;
  revenue_other: number;
  revenue_total: number;
  whatsapp_messages: number;
}
