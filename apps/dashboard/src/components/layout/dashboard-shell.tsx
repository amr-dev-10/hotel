"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BedDouble,
  Bot,
  CalendarDays,
  ChefHat,
  Gauge,
  GitBranch,
  ListChecks,
  LogOut,
  Menu,
  MessageCircle,
  Network,
  Sparkles,
  Shield,
  ShieldAlert,
  UserCircle,
  Users,
  Utensils,
} from "lucide-react";

import { DispatchAlert } from "@/components/dispatch-alert";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import { useWebSocket } from "@/hooks/useWebSocket";
import { cn, titleCase } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";

const navItems = [
  { label: "Overview", href: "overview", icon: Gauge },
  { label: "Tickets", href: "tickets", icon: ListChecks },
  { label: "Escalations", href: "escalations", icon: ShieldAlert },
  { label: "Guests", href: "guests", icon: Users },
  { label: "Reservations", href: "reservations", icon: CalendarDays },
  { label: "Rooms", href: "rooms", icon: BedDouble },
  { label: "F&B", href: "fnb", icon: Utensils },
  { label: "Kitchen", href: "kitchen", icon: ChefHat },
  { label: "Housekeeping", href: "housekeeping", icon: Sparkles },
  { label: "Hierarchy", href: "hierarchy", icon: Network },
  { label: "WhatsApp", href: "whatsapp", icon: MessageCircle },
];

const settingsNavItems = [
  { label: "Profile", href: "settings/profile", icon: UserCircle },
  { label: "Staff", href: "settings/staff", icon: Users },
  { label: "Roles & Access", href: "settings/roles", icon: Shield },
  { label: "Workflow", href: "settings/workflow", icon: GitBranch },
  { label: "AI Configuration", href: "ai", icon: Bot },
];

const allNavItems = [...navItems, ...settingsNavItems];

export function DashboardShell({
  hotelId,
  children,
}: {
  hotelId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.currentUser);
  const switchHotel = useAuthStore((state) => state.switchHotel);
  const logout = useAuthStore((state) => state.logout);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useWebSocket(hotelId);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    if (!token) {
      router.replace("/login");
      return;
    }

    if (currentUser?.hotel_id && currentUser.hotel_id !== hotelId) {
      router.replace(`/${currentUser.hotel_id}/overview`);
      return;
    }

    switchHotel(hotelId);
  }, [currentUser?.hotel_id, hotelId, mounted, router, switchHotel, token]);

  const activeSection = useMemo(
    () => allNavItems.find((item) => pathname?.includes(`/${item.href}`))?.label ?? "Dashboard",
    [pathname],
  );

  if (!mounted) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[17rem] -translate-x-full flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0",
          sidebarOpen && "translate-x-0",
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <div className="flex size-9 items-center justify-center rounded-md bg-[#0F3D91] text-white">
            <BedDouble className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Arcadia</p>
            <p className="truncate text-xs text-slate-500">{titleCase(currentUser?.job_role ?? "Hotel team")}</p>
          </div>
        </div>

        <nav className="grid gap-1 overflow-y-auto p-3">
          <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-normal text-slate-400">
            Operations
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const href = `/${hotelId}/${item.href}`;
            const active = pathname === href || pathname?.startsWith(`${href}/`);

            return (
              <Link
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950",
                  active && "bg-[#0F3D91] text-white hover:bg-[#0F3D91] hover:text-white",
                )}
                href={href}
                key={item.href}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
          <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-normal text-slate-400">
            Settings
          </p>
          {settingsNavItems.map((item) => {
            const Icon = item.icon;
            const href = `/${hotelId}/${item.href}`;
            const active = pathname === href || pathname?.startsWith(`${href}/`);

            return (
              <Link
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950",
                  active && "bg-[#0F3D91] text-white hover:bg-[#0F3D91] hover:text-white",
                )}
                href={href}
                key={item.href}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-slate-200 p-4">
          <div className="mb-3 rounded-md bg-slate-50 p-3">
            <p className="truncate text-sm font-semibold">{currentUser?.name ?? "Not signed in"}</p>
            <p className="truncate text-xs text-slate-500">{currentUser?.email ?? "Login required"}</p>
          </div>
          <Button
            className="w-full justify-start"
            type="button"
            variant="ghost"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
          >
            <LogOut />
            Sign out
          </Button>
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          type="button"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="lg:pl-[17rem]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              aria-label="Open navigation"
              className="lg:hidden"
              size="icon"
              type="button"
              variant="ghost"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu />
            </Button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Hotel workspace</p>
              <h1 className="text-lg font-semibold">{activeSection}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell hotelId={hotelId} />
            <span className="hidden rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 sm:inline-flex">
              Live sync
            </span>
            <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
              {hotelId.slice(0, 8)}
            </span>
          </div>
        </header>

        <main className="mx-auto grid w-full max-w-[1500px] gap-6 p-4 lg:p-8">{children}</main>
      </div>
      <DispatchAlert hotelId={hotelId} />
    </div>
  );
}
