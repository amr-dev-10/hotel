"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  hiddenLabel?: string;
  visibleLabel?: string;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      className,
      disabled,
      hiddenLabel = "Show password",
      visibleLabel = "Hide password",
      ...props
    },
    ref,
  ) => {
    const [isVisible, setIsVisible] = React.useState(false);
    const Icon = isVisible ? EyeOff : Eye;
    const label = isVisible ? visibleLabel : hiddenLabel;

    return (
      <div
        className={cn(
          "flex h-9 w-full items-center overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] shadow-[var(--shadow-control)] transition-colors focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary-ring)]",
          disabled && "cursor-not-allowed bg-[var(--panel-muted)] text-[var(--muted)]",
        )}
      >
        <input
          {...props}
          className={cn(
            "h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-[var(--muted)] disabled:cursor-not-allowed",
            className,
          )}
          disabled={disabled}
          ref={ref}
          type={isVisible ? "text" : "password"}
        />
        <button
          aria-label={label}
          aria-pressed={isVisible}
          className="flex h-full w-9 shrink-0 items-center justify-center border-l border-transparent text-[var(--muted)] transition-colors hover:bg-[var(--panel-muted)] hover:text-[var(--foreground)] focus:outline-none focus-visible:bg-[var(--panel-muted)] focus-visible:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          title={label}
          type="button"
          onClick={() => setIsVisible((current) => !current)}
        >
          <Icon aria-hidden="true" className="size-4" />
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
