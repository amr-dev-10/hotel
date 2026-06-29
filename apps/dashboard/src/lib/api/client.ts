import axios, { type AxiosRequestConfig } from "axios";

import type { ApiEnvelope } from "@/types/domain";

const apiBaseURL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";
export const ACCESS_DENIED_EVENT = "arcadia:access-denied";

export interface AccessDeniedEventDetail {
  message: string;
  requiredPermissions: string[];
  method: string;
  url: string;
  kind: "missing_permission" | "missing_any_permission" | "scope" | "forbidden";
}

export interface ApiErrorField {
  field: string;
  message: string;
  type?: string;
}

export interface ApiErrorDetails {
  message: string;
  code?: string;
  cause?: string;
  hint?: string;
  requestId?: string;
  fields: ApiErrorField[];
  context?: Record<string, unknown>;
  status?: number;
  method?: string;
  url?: string;
}

const defaultHeaders = apiBaseURL.includes("ngrok")
  ? {
      "ngrok-skip-browser-warning": "true",
    }
  : undefined;

export const api = axios.create({
  baseURL: apiBaseURL,
  timeout: 15000,
  headers: defaultHeaders,
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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const accessDenied = accessDeniedDetailFromError(error);
    if (accessDenied && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent<AccessDeniedEventDetail>(ACCESS_DENIED_EVENT, { detail: accessDenied }));
    }
    return Promise.reject(error);
  },
);

export async function apiGet<T>(url: string, config?: AxiosRequestConfig) {
  const response = await api.get<ApiEnvelope<T>>(url, config);
  return response.data.data;
}

export async function apiGetEnvelope<T>(url: string, config?: AxiosRequestConfig) {
  const response = await api.get<ApiEnvelope<T>>(url, config);
  return response.data;
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
  return apiErrorDetails(error).message;
}

export function apiErrorDetails(error: unknown): ApiErrorDetails {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    const detail = normalizeApiErrorDetail(data, error.message);
    return {
      ...detail,
      status: error.response?.status,
      method: (error.config?.method ?? "get").toUpperCase(),
      url: error.config?.url ?? "",
    };
  }

  return {
    message: error instanceof Error ? error.message : "Something went wrong",
    fields: [],
  };
}

export function accessDeniedDetailFromError(error: unknown): AccessDeniedEventDetail | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 403) {
    return null;
  }

  const url = error.config?.url ?? "";
  if (isAccessDeniedDialogIgnoredUrl(url)) {
    return null;
  }

  const detail = apiErrorDetails(error);
  const message = detail.message || "You do not have access to perform this action.";
  const requiredPermissions = parseRequiredPermissions(message);
  const lowerMessage = message.toLowerCase();
  const kind: AccessDeniedEventDetail["kind"] = lowerMessage.includes("missing one of permissions")
    ? "missing_any_permission"
    : lowerMessage.includes("missing permission")
      ? "missing_permission"
      : lowerMessage.includes("outside your access scope")
        ? "scope"
        : "forbidden";

  return {
    message,
    requiredPermissions,
    method: (error.config?.method ?? "get").toUpperCase(),
    url,
    kind,
  };
}

function normalizeApiErrorDetail(data: unknown, fallbackMessage: string): Omit<ApiErrorDetails, "status" | "method" | "url"> {
  if (isRecord(data)) {
    const detail = data.detail;
    if (isRecord(detail)) {
      return {
        message: stringValue(detail.message) || stringValue(data.message) || fallbackMessage,
        code: stringValue(detail.code) || undefined,
        cause: stringValue(detail.cause) || undefined,
        hint: stringValue(detail.hint) || undefined,
        requestId: stringValue(detail.request_id) || stringValue(detail.requestId) || undefined,
        fields: arrayValue(detail.fields).map(normalizeApiErrorField),
        context: recordValue(detail.context),
      };
    }

    return {
      message: stringValue(detail) || stringValue(data.message) || fallbackMessage,
      fields: [],
    };
  }

  return { message: fallbackMessage, fields: [] };
}

function normalizeApiErrorField(value: unknown): ApiErrorField {
  if (!isRecord(value)) {
    return { field: "", message: String(value || "Invalid value") };
  }
  return {
    field: stringValue(value.field) || "",
    message: stringValue(value.message) || "Invalid value",
    type: stringValue(value.type) || undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown) {
  return isRecord(value) ? value : undefined;
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseRequiredPermissions(message: string) {
  const missingOneMatch = message.match(/Missing one of permissions:\s*(.+)$/i);
  if (missingOneMatch?.[1]) {
    return missingOneMatch[1]
      .split(",")
      .map((permission) => permission.trim())
      .filter(Boolean);
  }

  const missingMatch = message.match(/Missing permission:\s*([a-z0-9_.-]+)/i);
  return missingMatch?.[1] ? [missingMatch[1]] : [];
}

function isAccessDeniedDialogIgnoredUrl(url: string) {
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/refresh") ||
    url.includes("/auth/me") ||
    url.startsWith("/guest") ||
    url.includes("/guest/")
  );
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
