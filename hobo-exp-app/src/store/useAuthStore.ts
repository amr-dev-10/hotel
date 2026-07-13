import { create } from 'zustand';
import { JobRole, Department, User } from '../types';
import { SessionManager } from '../services/session';
import { BackendAuth } from '../services/backend';
import { TenantManager } from '../services/tenant';
import { registerPushToken } from '../services/notifications';

interface AuthState {
  isLoggedIn: boolean;
  employeeId: string | null;
  name: string | null;
  email: string | null;
  jobRole: JobRole | null;
  status: boolean;
  department: Department | null;
  isHotelOwner: boolean;
  profilePicUrl: string | null;
  hotelId: string | null;
  hotelName: string | null;
  isLoading: boolean;

  init: () => Promise<void>;
  login: (params: {
    employeeId: string;
    phoneNumber: string;
    name: string;
    email: string;
    jobRole: JobRole;
    department: Department;
    isHotelOwner?: boolean;
    hotelId: string;
    hotelName: string;
    profilePicUrl?: string;
    status: boolean;
    accessToken?: string;
    refreshToken?: string | null;
  }) => Promise<void>;
  logout: () => Promise<void>;
  setStatus: (status: boolean) => Promise<void>;
  setProfilePicUrl: (url: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isLoggedIn: false,
  employeeId: null,
  name: null,
  email: null,
  jobRole: null,
  status: false,
  department: null,
  profilePicUrl: null,
  hotelId: null,
  hotelName: null,
  isLoading: true,
  isHotelOwner: false,

  async init() {
    set({ isLoading: true });
    try {
      const [loggedIn, employeeId, name, email, jobRole, status, department, profilePicUrl, hotelId, hotelName, isHotelOwner] =
        await Promise.all([
          SessionManager.isLoggedIn(),
          SessionManager.getEmployeeId(),
          SessionManager.getName(),
          SessionManager.getEmail(),
          SessionManager.getUserJobRole(),
          SessionManager.getStatus(),
          SessionManager.getUserDepartment(),
          SessionManager.getProfilePictureUrl(),
          SessionManager.getHotelId(),
          SessionManager.getHotelName(),
          SessionManager.getIsHotelOwner(),
        ]);
      TenantManager.syncFromSession(hotelId, hotelName);
      set({
        isLoggedIn: loggedIn && !!hotelId,
        employeeId,
        name,
        email,
        jobRole,
        status,
        department,
        isHotelOwner: !!isHotelOwner,
        profilePicUrl,
        hotelId,
        hotelName,
      });
      if (loggedIn && employeeId && hotelId) {
        void registerPushToken(employeeId).catch(() => undefined);
      }
    } finally {
      set({ isLoading: false });
    }
  },

  async login({
    employeeId,
    phoneNumber,
    name,
    email,
    jobRole,
    department,
    isHotelOwner,
    hotelId,
    hotelName,
    profilePicUrl,
    status,
    accessToken,
    refreshToken,
  }) {
    await SessionManager.saveLoginDetails(phoneNumber, employeeId);
    await SessionManager.setName(name);
    await SessionManager.setEmail(email);
    await SessionManager.setUserJobRole(jobRole);
    await SessionManager.setUserDepartment(department);
    await SessionManager.setIsHotelOwner(!!isHotelOwner);
    await SessionManager.setStatus(status);
    await SessionManager.setHotelId(hotelId);
    await SessionManager.setHotelName(hotelName);
    if (accessToken) await SessionManager.setTokens(accessToken, refreshToken);
    if (profilePicUrl) await SessionManager.setProfilePictureUrl(profilePicUrl);
    TenantManager.setTenant(hotelId, hotelName);
    void registerPushToken(employeeId).catch(() => undefined);
    set({
      isLoggedIn: true,
      employeeId,
      name,
      email,
      jobRole,
      department,
      isHotelOwner: !!isHotelOwner,
      status,
      profilePicUrl: profilePicUrl ?? null,
      hotelId,
      hotelName,
    });
  },

  async logout() {
    await SessionManager.logout();
    await BackendAuth.signOut();
    TenantManager.clearTenant();
    set({
      isLoggedIn: false,
      employeeId: null,
      name: null,
      email: null,
      jobRole: null,
      status: false,
      department: null,
      profilePicUrl: null,
      hotelId: null,
      hotelName: null,
      isHotelOwner: false,
    });
  },

  async setStatus(status: boolean) {
    await SessionManager.setStatus(status);
    set({ status });
  },

  async setProfilePicUrl(url: string) {
    await SessionManager.setProfilePictureUrl(url);
    set({ profilePicUrl: url });
  },
}));
