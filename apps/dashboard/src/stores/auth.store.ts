"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { CurrentUser } from "@/types/domain";

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  currentUser: CurrentUser | null;
  currentHotelId: string | null;
  setSession: (session: {
    token: string;
    refreshToken: string | null;
    currentUser: CurrentUser;
  }) => void;
  setCurrentUser: (currentUser: CurrentUser) => void;
  switchHotel: (hotelId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      currentUser: null,
      currentHotelId: null,
      setSession: ({ token, refreshToken, currentUser }) =>
        set({
          token,
          refreshToken,
          currentUser,
          currentHotelId: currentUser.hotel_id,
        }),
      setCurrentUser: (currentUser) =>
        set({
          currentUser,
          currentHotelId: currentUser.hotel_id,
        }),
      switchHotel: (hotelId) => set({ currentHotelId: hotelId }),
      logout: () =>
        set({
          token: null,
          refreshToken: null,
          currentUser: null,
          currentHotelId: null,
        }),
    }),
    { name: "arcadia-auth-storage" },
  ),
);
