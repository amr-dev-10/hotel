import axios, { type AxiosRequestConfig } from "axios";

import { usePlatformAuthStore } from "@/stores/platform-auth.store";
import type { ApiEnvelope } from "@/types/domain";

export const platformApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1",
  timeout: 15000,
});

platformApi.interceptors.request.use((config) => {
  const token = usePlatformAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export async function platformGet<T>(url: string, config?: AxiosRequestConfig) {
  const response = await platformApi.get<ApiEnvelope<T>>(url, config);
  return response.data.data;
}

export async function platformPost<T, TPayload = unknown>(
  url: string,
  payload?: TPayload,
  config?: AxiosRequestConfig,
) {
  const response = await platformApi.post<ApiEnvelope<T>>(url, payload, config);
  return response.data.data;
}
