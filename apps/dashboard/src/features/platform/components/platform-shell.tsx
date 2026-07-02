"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  CreditCard,
  DoorOpen,
  Hotel,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { cn } from "@/lib/utils";
import { usePlatformAuthStore } from "@/stores/platform-auth.store";

const navItems = [
  { label: "Stats", href: "/platform/stats", icon: LayoutDashboard },
  { label: "Hotels", href: "/platform/hotels", icon: Hotel },
  { label: "Users", href: "/platform/users", icon: UsersRound },
  { label: "Subscriptions", href: "/platform/subscriptions", icon: CreditCard },
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
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[var(--background-deep)] text-white shadow-[0_10px_28px_rgba(15,23,42,0.16)]">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-white/10 bg-[var(--primary)] text-white shadow-[var(--shadow-control)]">
              <ShieldCheck className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-white">Arcadia Platform</h1>
              <p className="truncate text-sm text-white/55">{adminName ?? adminEmail ?? "Super Admin"}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <nav className="flex gap-1 overflow-x-auto rounded-md border border-white/10 bg-white/[0.06] p-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  (item.href !== "/platform/stats" && pathname?.startsWith(`${item.href}/`)) ||
                  (item.href === "/platform/stats" && pathname === "/platform");

                return (
                  <Link
                    className={cn(
                      "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded px-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white",
                      active && "bg-[var(--primary)] text-white shadow-[0_10px_22px_rgba(37,99,235,0.28)]",
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
              <Button asChild className="border-white/10 bg-white/10 text-white hover:bg-white/15" type="button" variant="secondary">
                <Link href="/login">
                  <Building2 />
                  Hotel login
                </Link>
              </Button>
              <Button className="text-white/80 hover:bg-white/10 hover:text-white" type="button" variant="ghost" onClick={handleLogout}>
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
