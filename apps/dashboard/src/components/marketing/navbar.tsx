import Link from "next/link";
import { Building2, LogIn, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

const navigation = [
  { href: "#features", label: "Features" },
  { href: "#workflow", label: "Workflow" },
  { href: "#pricing", label: "Pricing" },
];

export function MarketingNavbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#111827]/95 text-white shadow-sm backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Marketing">
        <Link className="flex items-center gap-3 font-semibold tracking-normal" href="/">
          <span className="flex size-10 items-center justify-center rounded-md bg-white text-[var(--primary)]">
            <Building2 className="size-5" aria-hidden />
          </span>
          <span className="text-base sm:text-lg">Arcadia</span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {navigation.map((item) => (
            <Link className="text-sm font-medium text-white/78 transition hover:text-white" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button asChild className="hidden bg-white text-slate-950 hover:bg-slate-100 md:inline-flex" size="sm">
            <Link href="/platform/login">
              <ShieldCheck />
              Super Admin
            </Link>
          </Button>
          <Button asChild className="bg-[#F59E0B] text-slate-950 hover:bg-[#D97706]" size="sm">
            <Link href="/login">
              <LogIn />
              Login
            </Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
