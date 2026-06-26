import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold leading-5",
  {
    variants: {
      variant: {
        default: "bg-slate-100 text-slate-700",
        blue: "bg-[#0F3D91]/10 text-[#0F3D91]",
        teal: "bg-cyan-50 text-cyan-800",
        amber: "bg-amber-50 text-amber-800",
        rose: "bg-rose-50 text-rose-800",
        green: "bg-emerald-50 text-emerald-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
