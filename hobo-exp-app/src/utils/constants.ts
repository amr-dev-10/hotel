export const ROLES = {
  MANAGER: 'Manager' as const,
  ATTENDENT: 'Attendent' as const,
};

export const TASK_STAGES = {
  CREATED: 'Created' as const,
  ASSIGNED: 'Assigned' as const,
  EXECUTED: 'Executed' as const,
  COMPLETED: 'Completed' as const,
};

export const TASK_SLA_MS = 15 * 60 * 1000;
export const TASK_ACCEPT_WINDOW_MS = 10 * 60 * 1000;

// Per-department SLA used by the attendant Dashboard inline cards.
// Defaults: housekeeping 10 min, F&B / in-room dining 20 min, everything
// else falls through to TASK_SLA_MS (15 min).
const MIN = 60 * 1000;
const SLA_BY_DEPARTMENT: Record<string, number> = {
  housekeeping: 10 * MIN,
  foodandbeverages: 20 * MIN,
  inroomdining: 20 * MIN,
  fnb: 20 * MIN,
};
export function slaForDepartment(department: string | null | undefined): number {
  const key = (department ?? '').toString().trim().toLowerCase().replace(/[\s_-]+/g, '');
  return SLA_BY_DEPARTMENT[key] ?? TASK_SLA_MS;
}

export const DELIVERY_STATUS = {
  COMPLETED: 'Completed' as const,
  NOT_COMPLETED: 'NotCompleted' as const,
};

export const PRIORITY_COLORS: Record<string, string> = {
  High: '#BA1A1A',
  Important: '#855300',
  Routine: '#009668',
};

export const STAGE_LABELS: Record<string, string> = {
  Created: 'Created',
  Assigned: 'Assigned',
  Executed: 'Awaiting Approval',
  Completed: 'Completed',
};

export const SESSION_KEYS = {
  IS_LOGGED_IN: 'is_logged_in',
  EMPLOYEE_ID: 'employee_id',
  PHONE_NUMBER: 'phone_number',
  USER_NAME: 'user_name',
  USER_EMAIL: 'user_email',
  USER_JOB_ROLE: 'user_job_role',
  USER_STATUS: 'user_status',
  USER_DEPARTMENT: 'user_department',
  PROFILE_PIC_URL: 'profile_pic_url',
  HOTEL_ID: 'hotel_id',
  HOTEL_NAME: 'hotel_name',
  ACTIVE_TAB: 'active_tab',
  USER_IS_OWNER: 'user_is_owner',
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
};

export const COLORS = {
  PRIMARY: '#003D9B',
  PRIMARY_DARK: '#001848',
  PRIMARY_LIGHT: '#B2C5FF',
  PRIMARY_CONTAINER: '#0052CC',
  WHITE: '#FFFFFF',
  BLACK: '#000000',
  GREY: '#737685',
  LIGHT_GREY: '#F0F3FF',
  BORDER: '#C3C6D6',
  SUCCESS: '#15803D',
  WARNING: '#92400E',
  ERROR: '#BA1A1A',
  BACKGROUND: '#F9F9FF',
  TEXT_PRIMARY: '#101C2D',
  TEXT_SECONDARY: '#434654',

  // Surface tokens
  SURFACE: '#F9F9FF',
  SURFACE_LOW: '#F0F3FF',
  SURFACE_CONTAINER: '#E7EEFF',
  SURFACE_HIGH: '#DEE9FF',
  SURFACE_HIGHEST: '#D7E3FB',
  ON_SURFACE: '#101C2D',
  ON_SURFACE_VARIANT: '#434654',
  OUTLINE: '#737685',
  OUTLINE_VARIANT: '#C3C6D6',

  // Arcadia secondary (amber)
  SECONDARY: '#855300',
  SECONDARY_CONTAINER: '#FEA619',
  ON_SECONDARY_CONTAINER: '#684000',

  // Stage chip colors (Arcadia pastel system)
  CHIP_NEW_BG: '#CFFAFE',
  CHIP_NEW_TEXT: '#164E63',
  CHIP_ASSIGNED_BG: '#E0E7FF',
  CHIP_ASSIGNED_TEXT: '#312E81',
  CHIP_ONHOLD_BG: '#FFEDD5',
  CHIP_ONHOLD_TEXT: '#7C2D12',
  CHIP_COMPLETE_BG: '#D1FAE5',
  CHIP_COMPLETE_TEXT: '#064E3B',
  CHIP_CANCEL_BG: '#FFDAD6',
  CHIP_CANCEL_TEXT: '#93000A',
};
