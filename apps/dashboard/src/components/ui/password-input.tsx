"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
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
      <div className="relative">
        <Input
          {...props}
          className={cn("pr-10", className)}
          disabled={disabled}
          ref={ref}
          type={isVisible ? "text" : "password"}
        />
        <button
          aria-label={label}
          aria-pressed={isVisible}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-md text-slate-500 transition-colors hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F3D91]/20 disabled:cursor-not-allowed disabled:opacity-50"
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
