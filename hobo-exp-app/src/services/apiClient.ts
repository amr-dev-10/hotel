import { SessionManager } from './session';

declare const process: any;

const DEFAULT_MOBILE_API = 'http://10.0.2.2:8000/api/v1/mobile';

function normalizeMobileApiBase(rawUrl: string | undefined): string {
  const baseUrl = (rawUrl?.trim() || DEFAULT_MOBILE_API).replace(/\/+$/, '');
  if (/\/api\/v1\/mobile$/i.test(baseUrl)) return baseUrl;
  if (/\/api\/v1$/i.test(baseUrl)) return `${baseUrl}/mobile`;
  return `${baseUrl}/api/v1/mobile`;
}

export const MOBILE_API_BASE_URL = normalizeMobileApiBase(
  typeof process !== 'undefined' ? process?.env?.EXPO_PUBLIC_API_BASE_URL : undefined,
);

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  detail?: any;
  message?: string;
};

type RequestOptions = RequestInit & {
  token?: string | null;
  skipAuth?: boolean;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = options.skipAuth ? null : options.token ?? await SessionManager.getAccessToken();
  const response = await fetch(`${MOBILE_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const payload = await parsePayload<T>(response);
  if (!response.ok || payload.success === false) {
    throw new Error(errorMessage(payload, response.status));
  }
  return payload.data;
}

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export function apiPost<T>(path: string, payload?: unknown, options: RequestOptions = {}): Promise<T> {
  return apiRequest<T>(path, {
    ...options,
    method: 'POST',
    body: payload instanceof FormData ? payload : JSON.stringify(payload ?? {}),
  });
}

export function apiPatch<T>(path: string, payload?: unknown): Promise<T> {
  return apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(payload ?? {}) });
}

export function apiPut<T>(path: string, payload?: unknown): Promise<T> {
  return apiRequest<T>(path, { method: 'PUT', body: JSON.stringify(payload ?? {}) });
}

export function apiDelete<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'DELETE' });
}

export async function apiUpload(path: string, fileUri: string, fieldName = 'file'): Promise<{ url: string; file_url: string }> {
  const name = fileUri.split('/').pop() || `upload-${Date.now()}.jpg`;
  const ext = name.split('.').pop()?.toLowerCase();
  const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const form = new FormData();
  form.append(fieldName, { uri: fileUri, name, type } as any);
  const result = await apiPost<{ url: string; file_url: string }>(path, form);
  return {
    ...result,
    url: absolutizeMediaUrl(result.url || result.file_url),
    file_url: absolutizeMediaUrl(result.file_url || result.url),
  };
}

export function absolutizeMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const origin = MOBILE_API_BASE_URL.replace(/\/api\/v1\/mobile.*$/, '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

async function parsePayload<T>(response: Response): Promise<ApiEnvelope<T>> {
  const text = await response.text();
  if (!text) {
    return { success: response.ok, data: undefined as T };
  }
  try {
    return JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    return { success: response.ok, data: text as T };
  }
}

function errorMessage(payload: ApiEnvelope<unknown>, status: number): string {
  const detail = payload.detail;
  if (typeof detail === 'string') return detail;
  if (detail?.message) return String(detail.message);
  return payload.message || `Request failed (${status})`;
}
