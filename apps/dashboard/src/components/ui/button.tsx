import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[var(--shadow-control)] hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)]",
        secondary:
          "border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] shadow-[var(--shadow-control)] hover:border-[var(--border-strong)] hover:bg-[var(--panel-muted)]",
        outline:
          "border border-[var(--primary)] bg-transparent text-[var(--primary)] hover:bg-[var(--primary-soft)]",
        ghost:
          "text-[var(--muted-strong)] hover:bg-[var(--panel-muted)] hover:text-[var(--foreground)]",
        danger:
          "bg-[var(--destructive)] text-white shadow-[var(--shadow-control)] hover:bg-red-700 active:bg-red-800",
      },
      size: {
        sm: "h-8 px-2.5 text-xs",
        default: "h-9 px-3",
        lg: "h-10 px-4",
        icon: "h-9 w-9 px-0",
        iconSm: "h-8 w-8 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { buttonVariants };
