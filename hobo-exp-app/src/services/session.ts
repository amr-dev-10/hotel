import AsyncStorage from '@react-native-async-storage/async-storage';
import { SESSION_KEYS } from '../utils/constants';
import { JobRole, Department } from '../types';

export const SessionManager = {
  async saveLoginDetails(phoneNumber: string, employeeId: string) {
    await AsyncStorage.multiSet([
      [SESSION_KEYS.PHONE_NUMBER, phoneNumber],
      [SESSION_KEYS.EMPLOYEE_ID, employeeId],
      [SESSION_KEYS.IS_LOGGED_IN, 'true'],
    ]);
  },

  async isLoggedIn(): Promise<boolean> {
    const val = await AsyncStorage.getItem(SESSION_KEYS.IS_LOGGED_IN);
    return val === 'true';
  },

  async getEmployeeId(): Promise<string | null> {
    return AsyncStorage.getItem(SESSION_KEYS.EMPLOYEE_ID);
  },

  async getPhoneNumber(): Promise<string | null> {
    return AsyncStorage.getItem(SESSION_KEYS.PHONE_NUMBER);
  },

  async setName(name: string) {
    await AsyncStorage.setItem(SESSION_KEYS.USER_NAME, name);
  },

  async getName(): Promise<string | null> {
    return AsyncStorage.getItem(SESSION_KEYS.USER_NAME);
  },

  async setEmail(email: string) {
    await AsyncStorage.setItem(SESSION_KEYS.USER_EMAIL, email);
  },

  async getEmail(): Promise<string | null> {
    return AsyncStorage.getItem(SESSION_KEYS.USER_EMAIL);
  },

  async setUserJobRole(role: JobRole) {
    await AsyncStorage.setItem(SESSION_KEYS.USER_JOB_ROLE, role);
  },

  async getUserJobRole(): Promise<JobRole | null> {
    return AsyncStorage.getItem(SESSION_KEYS.USER_JOB_ROLE) as Promise<JobRole | null>;
  },

  async setStatus(status: boolean) {
    await AsyncStorage.setItem(SESSION_KEYS.USER_STATUS, String(status));
  },

  async getStatus(): Promise<boolean> {
    const val = await AsyncStorage.getItem(SESSION_KEYS.USER_STATUS);
    return val === 'true';
  },

  async setProfilePictureUrl(url: string) {
    await AsyncStorage.setItem(SESSION_KEYS.PROFILE_PIC_URL, url);
  },

  async getProfilePictureUrl(): Promise<string | null> {
    return AsyncStorage.getItem(SESSION_KEYS.PROFILE_PIC_URL);
  },

  async setHotelId(hotelId: string) {
    await AsyncStorage.setItem(SESSION_KEYS.HOTEL_ID, hotelId);
  },

  async getHotelId(): Promise<string | null> {
    return AsyncStorage.getItem(SESSION_KEYS.HOTEL_ID);
  },

  async setHotelName(hotelName: string) {
    await AsyncStorage.setItem(SESSION_KEYS.HOTEL_NAME, hotelName);
  },

  async getHotelName(): Promise<string | null> {
    return AsyncStorage.getItem(SESSION_KEYS.HOTEL_NAME);
  },

  async setActiveTab(tab: string) {
    await AsyncStorage.setItem(SESSION_KEYS.ACTIVE_TAB, tab);
  },

  async getActiveTab(): Promise<string | null> {
    return AsyncStorage.getItem(SESSION_KEYS.ACTIVE_TAB);
  },

  async setUserDepartment(department: Department) {
    await AsyncStorage.setItem(SESSION_KEYS.USER_DEPARTMENT, department);
  },

  async getUserDepartment(): Promise<Department | null> {
    return AsyncStorage.getItem(SESSION_KEYS.USER_DEPARTMENT) as Promise<Department | null>;
  },

  async setIsHotelOwner(isOwner: boolean) {
    await AsyncStorage.setItem(SESSION_KEYS.USER_IS_OWNER, String(isOwner));
  },

  async getIsHotelOwner(): Promise<boolean> {
    const val = await AsyncStorage.getItem(SESSION_KEYS.USER_IS_OWNER);
    return val === 'true';
  },

  async setTokens(accessToken: string, refreshToken?: string | null) {
    await AsyncStorage.setItem(SESSION_KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) {
      await AsyncStorage.setItem(SESSION_KEYS.REFRESH_TOKEN, refreshToken);
    }
  },

  async getAccessToken(): Promise<string | null> {
    return AsyncStorage.getItem(SESSION_KEYS.ACCESS_TOKEN);
  },

  async getRefreshToken(): Promise<string | null> {
    return AsyncStorage.getItem(SESSION_KEYS.REFRESH_TOKEN);
  },

  async logout() {
    await AsyncStorage.clear();
  },
};
