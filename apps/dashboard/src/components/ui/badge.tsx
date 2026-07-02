import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold leading-5",
  {
    variants: {
      variant: {
        default: "bg-[var(--panel-muted)] text-[var(--muted-strong)]",
        blue: "bg-[var(--primary-soft)] text-[var(--primary)]",
        teal: "bg-[var(--info-soft)] text-[var(--info)]",
        amber: "bg-[var(--warning-soft)] text-[var(--warning)]",
        rose: "bg-[var(--destructive-soft)] text-[var(--destructive)]",
        green: "bg-[var(--success-soft)] text-[var(--success)]",
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
