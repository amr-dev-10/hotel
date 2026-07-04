import {API_BASE_URL} from '../../config/api';
import type {ApiEnvelope} from '../../types/api';
import type {LoginData} from '../../types/domain';

export async function refreshAccessToken(refreshToken: string) {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    body: JSON.stringify({
      device_info: 'hoboerp-mobile',
      refresh_token: refreshToken,
    }),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const payload = (await parseJsonResponse(response)) as ApiEnvelope<LoginData>;

  if (!response.ok || payload.success === false || !payload.data) {
    const message =
      payload.message ??
      (typeof payload.detail === 'string' ? payload.detail : undefined) ??
      'Unable to refresh session.';
    throw new Error(message);
  }

  return payload.data;
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
