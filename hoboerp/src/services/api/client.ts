import {API_BASE_URL} from '../../config/api';
import type {ApiEnvelope} from '../../types/api';
import type {LoginData} from '../../types/domain';
import {refreshAccessToken} from '../session';

type RequestOptions = RequestInit & {
  onTokenRefresh?: (login: LoginData) => Promise<void> | void;
  refreshToken?: string | null;
  token?: string;
};

export class ApiRequestError extends Error {
  status: number;
  hint?: string;
  detail?: ApiEnvelope<unknown>['detail'];
  payload?: unknown;

  constructor({
    detail,
    hint,
    message,
    payload,
    status,
  }: {
    detail?: ApiEnvelope<unknown>['detail'];
    hint?: string;
    message: string;
    payload?: unknown;
    status: number;
  }) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.hint = hint;
    this.detail = detail;
    this.payload = payload;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiEnvelope<T>> {
  const {
    onTokenRefresh,
    refreshToken,
    token,
    headers,
    ...requestOptions
  } = options;
  let response = await sendRequest(path, requestOptions, headers, token);
  const payload = (await parseJsonResponse(response)) as ApiEnvelope<T>;

  if (
    response.status === 401 &&
    refreshToken &&
    !path.includes('/api/v1/auth/refresh')
  ) {
    const refreshed = await refreshAccessToken(refreshToken);
    await onTokenRefresh?.(refreshed);
    response = await sendRequest(
      path,
      requestOptions,
      headers,
      refreshed.access_token,
    );
    const retryPayload = (await parseJsonResponse(response)) as ApiEnvelope<T>;

    if (response.ok && retryPayload.success !== false) {
      return retryPayload;
    }

    throw requestError(response, retryPayload);
  }

  if (!response.ok || payload.success === false) {
    throw requestError(response, payload);
  }

  return payload;
}

function sendRequest(
  path: string,
  requestOptions: RequestInit,
  headers: RequestInit['headers'],
  token?: string,
) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? {Authorization: `Bearer ${token}`} : {}),
      ...(headers ?? {}),
    },
  });
}

function requestError<T>(response: Response, payload: ApiEnvelope<T>) {
  const fallback =
    response.status === 401 ? 'Session expired. Sign in again.' : 'Request failed.';
  const detail =
    typeof payload.detail === 'object' && !Array.isArray(payload.detail)
      ? payload.detail
      : undefined;

  return new ApiRequestError({
    detail: payload.detail,
    hint: detail?.hint ? String(detail.hint) : undefined,
    message:
      detail?.message
        ? String(detail.message)
        : payload.message ?? detailMessage(payload.detail) ?? fallback,
    payload,
    status: response.status,
  });
}

export function formatErrorDetails(error: unknown, fallback = 'Request failed.') {
  if (error instanceof ApiRequestError) {
    const lines = [`${error.message} (HTTP ${error.status || 'unknown'})`];

    if (error.hint) {
      lines.push(`Hint: ${error.hint}`);
    }

    const detail = detailMessage(error.detail);
    if (detail && detail !== error.message) {
      lines.push(`Detail: ${detail}`);
    }

    return lines.join('\n');
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      success: response.ok,
      message: text,
    };
  }
}

function detailMessage(detail: ApiEnvelope<unknown>['detail']) {
  if (!detail) {
    return undefined;
  }

  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map(item => {
        const location = Array.isArray(item.loc) ? item.loc.join('.') : '';
        const message = item.msg ? String(item.msg) : JSON.stringify(item);
        return [location, message].filter(Boolean).join(': ');
      })
      .join('\n');
  }

  if (detail.message) {
    return String(detail.message);
  }

  return JSON.stringify(detail);
}
