"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PaginationControls({
  page,
  pageSize,
  totalItems,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(page, 1), pageCount);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Total {totalItems}</p>
      <div className="flex items-center gap-2">
        <Button
          disabled={currentPage <= 1}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft />
          Previous
        </Button>
        <span className="min-w-28 rounded-md border border-[#0F3D91] bg-white px-3 py-2 text-center text-xs font-bold uppercase tracking-normal text-[#0F3D91]">
          Page {currentPage} / {pageCount}
        </span>
        <Button
          disabled={currentPage >= pageCount}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
