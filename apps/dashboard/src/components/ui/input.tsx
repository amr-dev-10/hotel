import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "h-9 w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 text-sm text-[var(--foreground)] shadow-[var(--shadow-control)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)] disabled:cursor-not-allowed disabled:bg-[var(--panel-muted)] disabled:text-[var(--muted)]",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";
