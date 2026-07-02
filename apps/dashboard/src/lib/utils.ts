import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function titleCase(value: string | null | undefined) {
  if (!value) {
    return "Unassigned";
  }

  return value
    .replace(/[_-]/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export function compactId(value: string | null | undefined) {
  if (!value) {
    return "None";
  }

  return value;
}

export function percent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "0%";
  }

  return `${Math.round(value * 100)}%`;
}

export function money(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
