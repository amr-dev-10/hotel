import { AlertTriangle, Loader2 } from "lucide-react";

import { apiErrorMessage } from "@/lib/api/client";

interface DataStateProps {
  isLoading?: boolean;
  error?: unknown;
  empty?: boolean;
  emptyTitle?: string;
}

export function DataState({ isLoading, error, empty, emptyTitle = "No records yet" }: DataStateProps) {
  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center gap-2 rounded-md border border-dashed border-[var(--border)] bg-[var(--panel)] text-sm text-[var(--muted)]">
        <Loader2 className="size-4 animate-spin" />
        Loading data
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-40 items-center justify-center gap-2 rounded-md border border-[var(--destructive-soft)] bg-[var(--destructive-soft)] px-4 text-sm text-[var(--destructive)]">
        <AlertTriangle className="size-4" />
        {apiErrorMessage(error)}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-[var(--border)] bg-[var(--panel)] px-4 text-sm text-[var(--muted)]">
        {emptyTitle}
      </div>
    );
  }

  return null;
}
