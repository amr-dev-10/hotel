import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';

import type {Session, UserProfile} from '../types/domain';

export const SESSION_STORAGE_KEY = 'hoboerp.session.v1';

type AuthState = {
  currentHotelId: string | null;
  currentUser: UserProfile | null;
  hotelName: string | null;
  isRestoring: boolean;
  refreshToken: string | null;
  token: string | null;
  login: (session: Session) => void;
  logout: () => void;
  setCurrentUser: (currentUser: UserProfile) => void;
  setHotelName: (hotelName: string | null) => void;
  setRestoring: (isRestoring: boolean) => void;
  setSession: (session: Session) => void;
};

function sessionState(session: Session) {
  return {
    currentHotelId: session.user.hotel_id,
    currentUser: session.user,
    refreshToken: session.refreshToken,
    token: session.accessToken,
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      currentHotelId: null,
      currentUser: null,
      hotelName: null,
      isRestoring: true,
      refreshToken: null,
      token: null,
      login: session => set(sessionState(session)),
      logout: () =>
        set({
          currentHotelId: null,
          currentUser: null,
          hotelName: null,
          refreshToken: null,
          token: null,
        }),
      setCurrentUser: currentUser =>
        set({
          currentHotelId: currentUser.hotel_id,
          currentUser,
        }),
      setHotelName: hotelName => set({hotelName}),
      setRestoring: isRestoring => set({isRestoring}),
      setSession: session => set(sessionState(session)),
    }),
    {
      name: 'hoboerp.auth.store.v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
