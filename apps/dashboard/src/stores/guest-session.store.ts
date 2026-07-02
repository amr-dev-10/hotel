"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { GuestPortalProfile } from "@/types/domain";

interface GuestSessionState {
  token: string | null;
  profile: GuestPortalProfile | null;
  setSession: (token: string, profile: GuestPortalProfile) => void;
  setProfile: (profile: GuestPortalProfile) => void;
  clear: () => void;
}

export const useGuestSessionStore = create<GuestSessionState>()(
  persist(
    (set) => ({
      token: null,
      profile: null,
      setSession: (token, profile) => set({ token, profile }),
      setProfile: (profile) => set({ profile }),
      clear: () => set({ token: null, profile: null }),
    }),
    { name: "arcadia-guest-session" },
  ),
);
