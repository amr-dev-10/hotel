import axios, { type AxiosRequestConfig } from "axios";

import type { ApiEnvelope } from "@/types/domain";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1",
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  if (typeof window === "undefined") {
    return config;
  }

  const token = readStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export async function apiGet<T>(url: string, config?: AxiosRequestConfig) {
  const response = await api.get<ApiEnvelope<T>>(url, config);
  return response.data.data;
}

export async function apiPost<T, TPayload = unknown>(
  url: string,
  payload?: TPayload,
  config?: AxiosRequestConfig,
) {
  const response = await api.post<ApiEnvelope<T>>(url, payload, config);
  return response.data.data;
}

export async function apiPut<T, TPayload = unknown>(
  url: string,
  payload?: TPayload,
  config?: AxiosRequestConfig,
) {
  const response = await api.put<ApiEnvelope<T>>(url, payload, config);
  return response.data.data;
}

export async function apiPatch<T, TPayload = unknown>(
  url: string,
  payload?: TPayload,
  config?: AxiosRequestConfig,
) {
  const response = await api.patch<ApiEnvelope<T>>(url, payload, config);
  return response.data.data;
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig) {
  const response = await api.delete<ApiEnvelope<T>>(url, config);
  return response.data.data;
}

export function apiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data as { detail?: string; message?: string } | undefined;
    return detail?.detail ?? detail?.message ?? error.message;
  }

  return error instanceof Error ? error.message : "Something went wrong";
}

function readStoredToken() {
  try {
    const raw = window.localStorage.getItem("arcadia-auth-storage");
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { state?: { token?: string | null } };
    return parsed.state?.token ?? null;
  } catch {
    return null;
  }
}
