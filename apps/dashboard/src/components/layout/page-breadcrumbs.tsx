import Link from "next/link";
import { ChevronRight, Home, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type BreadcrumbItem = {
  label: string;
  href?: string;
  icon?: LucideIcon;
};

export function PageBreadcrumbs({
  current,
  description,
  hotelId,
  items = [],
  srTitle,
}: {
  current: string;
  description?: string;
  hotelId: string;
  items?: BreadcrumbItem[];
  srTitle?: string;
}) {
  const homeCrumb: BreadcrumbItem = { label: "Overview", href: `/${hotelId}/overview`, icon: Home };
  const crumbs: BreadcrumbItem[] =
    current === "Overview" && !items.length ? [{ ...homeCrumb, href: undefined }] : [homeCrumb, ...items, { label: current }];

  return (
    <div className="grid min-w-0 gap-2">
      <h1 className="sr-only">{srTitle ?? current}</h1>
      <nav aria-label="Breadcrumb" className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5 text-sm sm:gap-2">
        {crumbs.map((crumb, index) => {
          const Icon = crumb.icon;
          const isCurrent = index === crumbs.length - 1;
          const content = (
            <>
              {Icon ? <Icon className="size-4 shrink-0" /> : null}
              <span className="truncate">{crumb.label}</span>
            </>
          );

          return (
            <span className="contents" key={`${crumb.label}-${index}`}>
              {index > 0 ? <ChevronRight className="size-4 shrink-0 text-[var(--muted)]" /> : null}
              {crumb.href && !isCurrent ? (
                <Link
                  className="inline-flex h-8 min-w-0 max-w-[calc(100vw-2rem)] items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[var(--muted-strong)] shadow-[var(--shadow-control)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] sm:max-w-72 lg:max-w-none"
                  href={crumb.href}
                  prefetch={false}
                >
                  {content}
                </Link>
              ) : (
                <span
                  aria-current={isCurrent ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 min-w-0 max-w-[calc(100vw-2rem)] items-center gap-2 rounded-md px-2.5 sm:max-w-72 lg:max-w-none",
                    isCurrent
                      ? "bg-[var(--primary-soft)] font-semibold text-[var(--primary)]"
                      : "border border-[var(--border)] bg-[var(--panel)] font-medium text-[var(--muted-strong)] shadow-[var(--shadow-control)]",
                  )}
                >
                  {content}
                </span>
              )}
            </span>
          );
        })}
      </nav>
      {description ? <p className="max-w-full text-sm text-[var(--muted)]">{description}</p> : null}
    </div>
  );
}
