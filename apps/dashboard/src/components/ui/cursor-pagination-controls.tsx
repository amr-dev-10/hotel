"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CursorPaginationControls({
  page,
  pageSize,
  loadedPages,
  totalItems,
  hasNextPage,
  isFetchingNextPage,
  onPrevious,
  onNext,
}: {
  page: number;
  pageSize: number;
  loadedPages: number;
  totalItems?: number;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const hasTotal = typeof totalItems === "number";
  const pageCount = hasTotal
    ? Math.max(1, Math.ceil(totalItems / pageSize))
    : Math.max(page, loadedPages + (hasNextPage ? 1 : 0));
  const canGoPrevious = page > 1;
  const canGoNext = hasTotal ? page < pageCount : page < loadedPages || Boolean(hasNextPage);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--muted-strong)] shadow-[var(--shadow-control)] sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-semibold uppercase tracking-normal text-[var(--muted)]">
        Total {hasTotal ? totalItems : loadedPages * pageSize}
      </p>
      <div className="flex items-center gap-2">
        <Button disabled={!canGoPrevious} size="sm" type="button" variant="secondary" onClick={onPrevious}>
          <ChevronLeft />
          Previous
        </Button>
        <span className="min-w-28 rounded-md border border-[var(--primary)] bg-[var(--primary-soft)] px-3 py-2 text-center text-xs font-bold uppercase tracking-normal text-[var(--primary)]">
          Page {page} / {pageCount}
        </span>
        <Button
          disabled={!canGoNext || isFetchingNextPage}
          size="sm"
          type="button"
          variant="secondary"
          onClick={onNext}
        >
          {isFetchingNextPage ? "Loading..." : "Next"}
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
