import AsyncStorage from '@react-native-async-storage/async-storage';

import {useAuthStore} from '../authStore';
import type {Session, UserProfile} from '../../types/domain';

const user: UserProfile = {
  email: 'owner@admin.com',
  hotel_id: 'hotel-1',
  id: 'user-1',
  name: 'Owner',
  permissions: ['*'],
};

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    user,
    ...overrides,
  };
}

function resetAuthStore() {
  useAuthStore.setState({
    currentHotelId: null,
    currentUser: null,
    hotelName: null,
    isRestoring: true,
    refreshToken: null,
    token: null,
  });
}

describe('authStore', () => {
  beforeEach(async () => {
    resetAuthStore();
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('logs in with a session', () => {
    const session = makeSession();

    useAuthStore.getState().login(session);

    expect(useAuthStore.getState()).toMatchObject({
      currentHotelId: 'hotel-1',
      currentUser: user,
      refreshToken: 'refresh-token',
      token: 'access-token',
    });
  });

  it('sets the active session', () => {
    const nextUser = {...user, hotel_id: 'hotel-2', id: 'user-2'};

    useAuthStore.getState().setSession(
      makeSession({
        accessToken: 'next-access',
        refreshToken: 'next-refresh',
        user: nextUser,
      }),
    );

    expect(useAuthStore.getState()).toMatchObject({
      currentHotelId: 'hotel-2',
      currentUser: nextUser,
      refreshToken: 'next-refresh',
      token: 'next-access',
    });
  });

  it('sets the hotel name independently from the session', () => {
    useAuthStore.getState().setHotelName('Arcadia Suites');

    expect(useAuthStore.getState().hotelName).toBe('Arcadia Suites');

    useAuthStore.getState().setHotelName(null);

    expect(useAuthStore.getState().hotelName).toBeNull();
  });

  it('logs out and clears session scoped values', () => {
    useAuthStore.getState().setSession(makeSession());
    useAuthStore.getState().setHotelName('Arcadia Suites');

    useAuthStore.getState().logout();

    expect(useAuthStore.getState()).toMatchObject({
      currentHotelId: null,
      currentUser: null,
      hotelName: null,
      refreshToken: null,
      token: null,
    });
  });
});
