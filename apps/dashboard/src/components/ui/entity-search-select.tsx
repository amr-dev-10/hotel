"use client";

import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface EntitySearchOption {
  value: string;
  label: string;
  description?: string | null;
}

export function EntitySearchSelect({
  id,
  value,
  selectedLabel,
  search,
  options,
  placeholder,
  emptyText = "No matches",
  isLoading,
  disabled,
  onSearchChange,
  onValueChange,
}: {
  id: string;
  value: string;
  selectedLabel?: string;
  search: string;
  options: EntitySearchOption[];
  placeholder: string;
  emptyText?: string;
  isLoading?: boolean;
  disabled?: boolean;
  onSearchChange: (value: string) => void;
  onValueChange: (value: string, option?: EntitySearchOption) => void;
}) {
  const showSuggestions = !disabled && !value && search.trim().length > 0;

  if (value) {
    return (
      <div className="flex h-9 items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm">
        <span className="min-w-0 truncate font-medium text-slate-900">{selectedLabel ?? "Selected"}</span>
        <Button
          aria-label="Clear selected value"
          size="icon"
          type="button"
          variant="ghost"
          onClick={() => {
            onValueChange("");
            onSearchChange("");
          }}
        >
          <X />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <Input
        className="pr-9"
        disabled={disabled}
        id={id}
        placeholder={placeholder}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      {showSuggestions ? (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {isLoading ? (
            <p className="px-3 py-2 text-sm text-slate-500">Searching...</p>
          ) : options.length ? (
            options.map((option) => (
              <button
                className="grid w-full gap-0.5 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50"
                key={option.value}
                type="button"
                onClick={() => {
                  onValueChange(option.value, option);
                  onSearchChange("");
                }}
              >
                <span className="truncate font-medium text-slate-900">{option.label}</span>
                {option.description ? (
                  <span className="truncate text-xs text-slate-500">{option.description}</span>
                ) : null}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-slate-500">{emptyText}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
