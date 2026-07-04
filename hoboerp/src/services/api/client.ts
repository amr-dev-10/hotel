import {API_BASE_URL} from '../../config/api';
import type {ApiEnvelope} from '../../types/api';

type RequestOptions = RequestInit & {
  token?: string;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiEnvelope<T>> {
  const {token, headers, ...requestOptions} = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? {Authorization: `Bearer ${token}`} : {}),
      ...(headers ?? {}),
    },
  });
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || payload.success === false) {
    const fallback =
      response.status === 401 ? 'Session expired. Sign in again.' : 'Request failed.';
    throw new Error(payload.detail?.message ?? payload.message ?? fallback);
  }

  return payload;
}
