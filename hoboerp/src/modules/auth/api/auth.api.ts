import {apiRequest} from '../../../services/api';
import type {LoginData, UserProfile} from '../../../types/domain';

export function login(email: string, password: string) {
  return apiRequest<LoginData>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({email, password}),
  });
}

export function me(token: string) {
  return apiRequest<UserProfile>('/api/v1/auth/me', {token});
}
