"use client";

import { toast } from "sonner";

import { API_ERROR_DETAILS_EVENT, apiErrorDetails, type ApiErrorDetails } from "@/lib/api/client";

export { API_ERROR_DETAILS_EVENT };

export function showApiErrorToast(error: unknown, fallbackMessage?: string) {
  const detail = apiErrorDetails(error);
  const message = fallbackMessage || detail.message;

  toast.error(message, {
    action: hasUsefulDetails(detail)
      ? {
          label: "Details",
          onClick: () => {
            window.dispatchEvent(
              new CustomEvent<ApiErrorDetails>(API_ERROR_DETAILS_EVENT, {
                detail: { ...detail, message },
              }),
            );
          },
        }
      : undefined,
  });
}

function hasUsefulDetails(detail: ApiErrorDetails) {
  return Boolean(
    detail.cause ||
      detail.hint ||
      detail.requestId ||
      detail.code ||
      detail.fields.length ||
      detail.status,
  );
}
