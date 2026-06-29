"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ApiErrorDetails } from "@/lib/api/client";
import { API_ERROR_DETAILS_EVENT } from "@/lib/api/error-toast";

type ApiErrorDetailsState = ApiErrorDetails & {
  shownAt: number;
};

export function ApiErrorDetailsDialog() {
  const [error, setError] = useState<ApiErrorDetailsState | null>(null);

  useEffect(() => {
    function handleErrorDetails(event: Event) {
      const detail = (event as CustomEvent<ApiErrorDetails>).detail;
      if (!detail) {
        return;
      }
      setError({ ...detail, shownAt: Date.now() });
    }

    window.addEventListener(API_ERROR_DETAILS_EVENT, handleErrorDetails);
    return () => window.removeEventListener(API_ERROR_DETAILS_EVENT, handleErrorDetails);
  }, []);

  return (
    <Dialog open={Boolean(error)} onOpenChange={(open) => !open && setError(null)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-md bg-rose-50 text-rose-700">
            <AlertTriangle className="size-5" />
          </div>
          <DialogTitle>{error?.message || "Request failed"}</DialogTitle>
          <DialogDescription>
            Review the cause and request id before retrying or sharing the issue with support.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="grid gap-4">
            <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              {error.cause ? <DetailRow label="Cause" value={error.cause} /> : null}
              {error.hint ? <DetailRow label="Suggested action" value={error.hint} /> : null}
              {error.code ? <DetailRow code label="Code" value={error.code} /> : null}
              {error.requestId ? <DetailRow code label="Request ID" value={error.requestId} /> : null}
              {error.status ? <DetailRow label="HTTP status" value={String(error.status)} /> : null}
              {error.method && error.url ? <DetailRow code label="Request" value={`${error.method} ${error.url}`} /> : null}
            </div>

            {error.fields.length ? (
              <div className="grid gap-2">
                <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Fields</p>
                <div className="grid gap-2">
                  {error.fields.map((field, index) => (
                    <div className="rounded-md border border-slate-200 bg-white p-3 text-sm" key={`${field.field}-${index}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="font-mono" variant="blue">
                          {field.field || "request"}
                        </Badge>
                        {field.type ? <span className="text-xs text-slate-500">{field.type}</span> : null}
                      </div>
                      <p className="mt-2 text-slate-700">{field.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {!error.cause && !error.hint && !error.fields.length ? (
              <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600">
                <Info className="mt-0.5 size-4 shrink-0" />
                <p>No extra cause was provided for this error.</p>
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button type="button" onClick={() => setError(null)}>
                OK
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ code = false, label, value }: { code?: boolean; label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[140px_1fr] sm:items-start">
      <span className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</span>
      <span className={code ? "break-all font-mono text-xs text-slate-800" : "text-slate-800"}>{value}</span>
    </div>
  );
}
