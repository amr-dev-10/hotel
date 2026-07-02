import axios, { type AxiosRequestConfig } from "axios";

import type { ApiEnvelope } from "@/types/domain";

export const guestApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1",
  timeout: 15000,
  headers: {
    "ngrok-skip-browser-warning": "true",
  },
});

guestApi.interceptors.request.use((config) => {
  if (typeof window === "undefined") {
    return config;
  }
  const token = readGuestToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function guestGet<T>(url: string, config?: AxiosRequestConfig) {
  const response = await guestApi.get<ApiEnvelope<T>>(url, config);
  return response.data.data;
}

export async function guestPost<T, TPayload = unknown>(
  url: string,
  payload?: TPayload,
  config?: AxiosRequestConfig,
) {
  const response = await guestApi.post<ApiEnvelope<T>>(url, payload, config);
  return response.data.data;
}

function readGuestToken() {
  try {
    const raw = window.localStorage.getItem("arcadia-guest-session");
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { state?: { token?: string | null } };
    return parsed.state?.token ?? null;
  } catch {
    return null;
  }
}
