import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <span className="relative block">
    <select
      ref={ref}
      className={cn(
        "h-9 w-full appearance-none rounded-md border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-950 outline-none transition-colors focus:border-[#0F3D91] focus:ring-2 focus:ring-[#0F3D91]/15 disabled:cursor-not-allowed disabled:bg-slate-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
  </span>
));
Select.displayName = "Select";
