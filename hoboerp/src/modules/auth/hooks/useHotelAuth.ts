import {useCallback, useState} from 'react';

import type {ApiEnvelope} from '../../../types/api';
import type {LoginData, Session, UserProfile} from '../../../types/domain';

type RequestFn = <T>(
  path: string,
  options?: RequestInit,
  token?: string,
) => Promise<ApiEnvelope<T>>;

export function useHotelAuth(
  request: RequestFn,
  onAuthenticated: (token: string, hotelId: string) => Promise<void>,
) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleLogin = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);

    try {
      const login = await request<LoginData>(
        '/api/v1/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({email: email.trim(), password}),
        },
        undefined,
      );
      const token = login.data?.access_token;
      const refreshToken = login.data?.refresh_token;

      if (!token || !refreshToken) {
        throw new Error('Login succeeded but no token was returned.');
      }

      const profile = await request<UserProfile>('/api/v1/auth/me', {}, token);

      if (!profile.data?.hotel_id) {
        throw new Error('This account is missing hotel context.');
      }

      setSession({
        accessToken: token,
        refreshToken,
        user: profile.data,
      });
      await onAuthenticated(token, profile.data.hotel_id);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setAuthLoading(false);
    }
  }, [email, onAuthenticated, password, request]);

  const resetAuth = useCallback(() => {
    setSession(null);
  }, []);

  return {
    authError,
    authLoading,
    email,
    handleLogin,
    password,
    resetAuth,
    session,
    setEmail,
    setPassword,
  };
}
