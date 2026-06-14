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
      <div className="flex min-h-40 items-center justify-center gap-2 rounded-md border border-dashed border-slate-200 bg-white text-sm text-slate-500">
        <Loader2 className="size-4 animate-spin" />
        Loading data
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-40 items-center justify-center gap-2 rounded-md border border-rose-100 bg-rose-50 px-4 text-sm text-rose-800">
        <AlertTriangle className="size-4" />
        {apiErrorMessage(error)}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-slate-200 bg-white px-4 text-sm text-slate-500">
        {emptyTitle}
      </div>
    );
  }

  return null;
}
