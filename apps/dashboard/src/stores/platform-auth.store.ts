"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PlatformAuthState {
  token: string | null;
  adminName: string | null;
  adminEmail: string | null;
  setPlatformSession: (session: { token: string; adminName: string | null; adminEmail: string }) => void;
  logout: () => void;
}

export const usePlatformAuthStore = create<PlatformAuthState>()(
  persist(
    (set) => ({
      token: null,
      adminName: null,
      adminEmail: null,
      setPlatformSession: ({ token, adminName, adminEmail }) =>
        set({
          token,
          adminName,
          adminEmail,
        }),
      logout: () =>
        set({
          token: null,
          adminName: null,
          adminEmail: null,
        }),
    }),
    { name: "arcadia-platform-auth-storage" },
  ),
);
