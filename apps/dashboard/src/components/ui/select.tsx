import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative flex w-full items-center">
    <select
      ref={ref}
      className={cn(
        "h-9 w-full appearance-none rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 pr-9 text-sm text-[var(--foreground)] shadow-[var(--shadow-control)] outline-none transition-colors focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-ring)] disabled:cursor-not-allowed disabled:bg-[var(--panel-muted)] disabled:text-[var(--muted)]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 size-4 text-[var(--muted)]" />
  </div>
));
Select.displayName = "Select";
