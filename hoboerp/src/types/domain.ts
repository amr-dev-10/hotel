export type UserProfile = {
  id: string;
  hotel_id: string;
  department_id?: string | null;
  name?: string;
  email: string;
  user_type?: string;
  staff_level?: string;
  job_role?: string;
  is_hotel_owner?: boolean;
  is_on_duty?: boolean;
  permissions?: string[];
};

export type LoginData = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in_minutes: number;
};

export type ArcadiaRecord = Record<string, unknown>;

export type Session = {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
};
