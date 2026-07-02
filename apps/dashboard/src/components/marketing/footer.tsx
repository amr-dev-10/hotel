import Link from "next/link";
import { Building2 } from "lucide-react";

const footerLinks = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "/login", label: "Hotel login" },
  { href: "/platform/login", label: "Super Admin" },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-[var(--primary)] text-white">
            <Building2 className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-semibold text-slate-950">Arcadia Hotel Platform</p>
            <p className="text-sm text-slate-500">Hotel operations, guest service, and platform control.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-slate-600">
          {footerLinks.map((item) => (
            <Link className="transition hover:text-[var(--primary)]" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
