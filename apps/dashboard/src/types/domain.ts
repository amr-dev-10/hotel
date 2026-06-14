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
  hotel_id?: string;
  ticket_id: string;
  rule_id?: string;
  from_user_id?: string | null;
  to_user_id?: string | null;
  escalated_from?: string | null;
  escalated_to?: string | null;
  reason: string;
  notes?: string | null;
  level?: number;
  escalation_level?: number;
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

export interface Department {
  id: string;
  hotel_id: string;
  name: string;
  key: string;
  description: string | null;
  keywords: string[];
  resolution_time: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface Permission {
  id: string;
  group_id: string | null;
  code: string;
  name: string;
  module: string;
}

export interface PermissionGroup {
  id: string;
  name: string;
  module: string;
  sort_order: number;
}

export interface Role {
  id: string;
  hotel_id: string;
  name: string;
  description: string | null;
  is_system_role: boolean;
}

export interface DepartmentStaffNode {
  id: string;
  name: string;
  staff_level: string | null;
  reports_to: string | null;
  on_shift: boolean;
  open_tickets: number;
}

export interface SupervisorNode extends DepartmentStaffNode {
  attendants: DepartmentStaffNode[];
}

export interface DepartmentHierarchy {
  department: string;
  manager: DepartmentStaffNode | null;
  supervisors: SupervisorNode[];
  attendants: DepartmentStaffNode[];
}

export interface AISettings {
  provider: string;
  model: string | null;
  status: string;
  last_tested_at: string | null;
  embedding_provider: string | null;
  embedding_model: string | null;
}

export interface AISettingsTest {
  success: boolean;
  provider: string;
  response_time_ms: number;
  response_preview: string;
}

export interface WhatsAppAccount {
  id: string;
  hotel_id: string;
  business_name: string;
  phone_number: string | null;
  phone_number_id: string;
  waba_id: string | null;
  webhook_verify_token: string | null;
  status: string;
  token_expires_at: string | null;
  onboarding_step: string;
  connected_at: string | null;
  last_verified_at: string | null;
}

export interface WhatsAppTemplate {
  id: string;
  hotel_id: string;
  template_name: string;
  template_type: string;
  language: string;
  status: string;
  meta_template_id: string | null;
  header_params: Record<string, unknown>[];
  body_params: Record<string, unknown>[];
}

export interface WhatsAppConversation {
  id: string;
  hotel_id: string;
  guest_id: string | null;
  phone: string;
  status: string;
  last_message_at: string | null;
}

export interface WhatsAppMessage {
  id: string;
  hotel_id: string;
  conversation_id: string;
  direction: string;
  message_type: string;
  message_text: string | null;
  meta_message_id: string | null;
  status: string;
  created_at: string;
}

export interface WhatsAppHealth {
  id: string;
  hotel_id: string;
  whatsapp_account_id: string;
  token_status: string;
  webhook_status: string;
  error_count_24h: number;
  last_error_message: string | null;
  checked_at: string | null;
}

export interface WorkflowDefinition {
  id: string;
  hotel_id: string;
  name: string;
  entity_type: string;
  is_default: boolean;
  is_active: boolean;
}

export interface WorkflowState {
  id: string;
  hotel_id: string;
  workflow_id: string;
  name: string;
  state_key: string;
  state_type: string;
  color: string | null;
  sort_order: number;
  required_permission: string | null;
  auto_assign: boolean;
}

export interface WorkflowTransition {
  id: string;
  hotel_id: string;
  workflow_id: string;
  from_state_id: string;
  to_state_id: string;
  trigger_type: string;
  required_permission: string | null;
  auto_timer_minutes: number | null;
  notify_roles: string[];
}

export interface EscalationRule {
  id: string;
  hotel_id: string;
  department_id: string | null;
  ticket_type: string | null;
  task_category: string | null;
  escalation_level: number;
  trigger_after_minutes: number;
  action: string;
  target_staff_level: string | null;
  auto_reassign: boolean;
  send_notification: boolean;
  notification_channels: string[];
  is_active: boolean;
  created_at: string;
}

export interface TaskTypeSLA {
  id: string;
  hotel_id: string;
  department_id: string;
  task_category: string;
  sla_minutes: number;
  accept_timeout_minutes: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface RoutingRule {
  id: string;
  hotel_id: string;
  ticket_type: string;
  target_staff_level: string | null;
  target_user_id: string | null;
  skip_normal_assignment: boolean;
  priority_override: number | null;
  notify_immediately: boolean;
  notification_channels: string[];
  is_active: boolean;
  created_at: string;
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
