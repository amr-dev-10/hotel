"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  DoorOpen,
  Hotel,
  LayoutDashboard,
  Settings,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { cn } from "@/lib/utils";
import { usePlatformAuthStore } from "@/stores/platform-auth.store";

const navItems = [
  { label: "Stats", href: "/platform/stats", icon: LayoutDashboard },
  { label: "Hotels", href: "/platform/hotels", icon: Hotel },
  { label: "Settings", href: "/platform/settings", icon: Settings },
];

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const token = usePlatformAuthStore((state) => state.token);
  const adminName = usePlatformAuthStore((state) => state.adminName);
  const adminEmail = usePlatformAuthStore((state) => state.adminEmail);
  const logout = usePlatformAuthStore((state) => state.logout);

  useEffect(() => {
    if (!token) {
      router.replace("/platform/login");
    }
  }, [router, token]);

  if (!token) {
    return <DataState isLoading />;
  }

  function handleLogout() {
    logout();
    router.replace("/platform/login");
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white">
              <ShieldCheck className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold">Arcadia Platform</h1>
              <p className="truncate text-sm text-slate-500">{adminName ?? adminEmail ?? "Super Admin"}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <nav className="flex gap-1 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  (item.href !== "/platform/stats" && pathname?.startsWith(`${item.href}/`)) ||
                  (item.href === "/platform/stats" && pathname === "/platform");

                return (
                  <Link
                    className={cn(
                      "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-white hover:text-slate-950",
                      active && "bg-white text-slate-950 shadow-sm",
                    )}
                    href={item.href}
                    key={item.href}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex gap-2">
              <Button asChild type="button" variant="secondary">
                <Link href="/login">
                  <Building2 />
                  Hotel login
                </Link>
              </Button>
              <Button type="button" variant="ghost" onClick={handleLogout}>
                <DoorOpen />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1500px] gap-6 p-4 lg:p-8">{children}</div>
    </main>
  );
}
