"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BedDouble,
  Bot,
  CalendarDays,
  ChefHat,
  LogIn,
  Gauge,
  GitBranch,
  ListChecks,
  LogOut,
  Menu,
  MessageCircle,
  Network,
  ScrollText,
  Sparkles,
  Shield,
  ShieldAlert,
  UserCircle,
  UserCheck,
  Users,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { DispatchAlert } from "@/components/dispatch-alert";
import { apiErrorDetails } from "@/lib/api/client";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import { Permissions, ticketViewPermissions } from "@/constants/permissions";
import { useShifts, useUpdateShift } from "@/features/staff/hooks/useStaff";
import { useRouteHotelId } from "@/hooks/useRouteHotelId";
import { useWebSocket } from "@/hooks/useWebSocket";
import { api, apiGet } from "@/lib/api/client";
import { showApiErrorToast } from "@/lib/api/error-toast";
import { cn, titleCase } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import type { ApiEnvelope, CurrentUser, EmployeeShift } from "@/types/domain";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permissions?: string[];
  adminOnly?: boolean;
};

type ShellHotel = {
  id: string;
  name: string;
};

const navItems: NavItem[] = [
  { label: "Overview", href: "overview", icon: Gauge },
  {
    label: "Staff Portal",
    href: "staff-portal",
    icon: UserCheck,
    permissions: [Permissions.TICKET_VIEW_OWN, Permissions.TICKET_ACCEPT, Permissions.SHIFT_VIEW_OWN, Permissions.SHIFT_UPDATE_OWN],
  },
  { label: "Tickets", href: "tickets", icon: ListChecks, permissions: [...ticketViewPermissions] },
  { label: "Escalations", href: "escalations", icon: ShieldAlert, permissions: [...ticketViewPermissions] },
  { label: "Guests", href: "guests", icon: Users, permissions: [Permissions.GUEST_VIEW, Permissions.GUEST_VIEW_BASIC, Permissions.GUEST_VIEW_SENSITIVE] },
  { label: "Reservations", href: "reservations", icon: CalendarDays, permissions: [Permissions.RESERVATION_VIEW, Permissions.RESERVATION_MANAGE] },
  { label: "Rooms", href: "rooms", icon: BedDouble, permissions: [Permissions.ROOM_VIEW] },
  { label: "F&B", href: "fnb", icon: Utensils, permissions: [Permissions.MENU_VIEW, Permissions.RESTAURANT_MANAGE] },
  { label: "Kitchen", href: "kitchen", icon: ChefHat, permissions: [Permissions.RESTAURANT_MANAGE] },
  { label: "Housekeeping", href: "housekeeping", icon: Sparkles, permissions: [Permissions.HOUSEKEEPING_MANAGE, Permissions.TICKET_VIEW_DEPT, Permissions.TICKET_VIEW_ALL] },
  { label: "Hierarchy", href: "hierarchy", icon: Network, permissions: [Permissions.USER_VIEW, Permissions.TICKET_VIEW_DEPT, Permissions.TICKET_VIEW_ALL] },
  { label: "WhatsApp", href: "whatsapp", icon: MessageCircle, permissions: [Permissions.WHATSAPP_HEALTH_VIEW, Permissions.LIVE_CHAT_MANAGE] },
];

const settingsNavItems: NavItem[] = [
  { label: "Profile", href: "settings/profile", icon: UserCircle },
  { label: "Staff", href: "settings/staff", icon: Users, permissions: [Permissions.USER_VIEW, Permissions.USER_MANAGE] },
  { label: "Roles & Access", href: "settings/roles", icon: Shield, permissions: [Permissions.ROLE_VIEW, Permissions.ROLE_MANAGE] },
  { label: "Workflow", href: "settings/workflow", icon: GitBranch, permissions: [Permissions.WORKFLOW_MANAGE, Permissions.HOTEL_SETTINGS_MANAGE] },
  { label: "Audit Logs", href: "settings/audit", icon: ScrollText, adminOnly: true },
  { label: "AI Configuration", href: "ai", icon: Bot, permissions: [Permissions.BOT_VIEW, Permissions.BOT_MANAGE, Permissions.HOTEL_SETTINGS_MANAGE] },
];

export function DashboardShell({
  hotelId: hotelIdProp,
  children,
}: {
  hotelId?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const hotelId = useRouteHotelId(hotelIdProp);
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.currentUser);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const switchHotel = useAuthStore((state) => state.switchHotel);
  const logout = useAuthStore((state) => state.logout);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const lastAuthRefreshAt = useRef(0);
  useWebSocket(hotelId);
  const hotelQuery = useQuery({
    queryKey: ["hotel", hotelId, "shell"],
    queryFn: () => apiGet<ShellHotel>(`/hotels/${hotelId}`),
    enabled: Boolean(token && hotelId),
    staleTime: 60_000,
  });

  const refreshCurrentUser = useCallback(async () => {
    if (!token) {
      return;
    }

    const now = Date.now();
    if (now - lastAuthRefreshAt.current < 30_000) {
      return;
    }
    lastAuthRefreshAt.current = now;

    try {
      const response = await api.get<ApiEnvelope<CurrentUser>>("/auth/me");
      setCurrentUser(response.data.data);
    } catch (error) {
      if (isSessionExpiredError(error)) {
        logout();
        router.replace("/login");
      }
    }
  }, [logout, router, setCurrentUser, token]);

  const isHotelAdmin = Boolean(
    currentUser?.is_hotel_owner ||
      currentUser?.user_type === "HOTEL_ADMIN" ||
      currentUser?.staff_level?.toLowerCase() === "admin",
  );
  const visibleNavItems = useMemo(
    () => navItems.filter((item) => canAccessNavItem(item, currentUser, isHotelAdmin)),
    [currentUser, isHotelAdmin],
  );
  const visibleSettingsNavItems = useMemo(
    () => settingsNavItems.filter((item) => canAccessNavItem(item, currentUser, isHotelAdmin)),
    [currentUser, isHotelAdmin],
  );
  const allNavItems = useMemo(() => [...visibleNavItems, ...visibleSettingsNavItems], [visibleNavItems, visibleSettingsNavItems]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !token) {
      return;
    }

    void refreshCurrentUser();
  }, [mounted, refreshCurrentUser, token]);

  useEffect(() => {
    if (!mounted || !token) {
      return;
    }

    const handleFocus = () => {
      void refreshCurrentUser();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshCurrentUser();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [mounted, refreshCurrentUser, token]);

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
    [allNavItems, pathname],
  );
  const isStaffPortalRoute = pathname === `/${hotelId}/staff-portal` || pathname?.startsWith(`/${hotelId}/staff-portal/`);
  const hotelName = hotelQuery.data?.name ?? "Arcadia";

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
          {visibleNavItems.map((item) => {
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
                prefetch={false}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
          <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-normal text-slate-400">
            Settings
          </p>
          {visibleSettingsNavItems.map((item) => {
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
                prefetch={false}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto h-3" />
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
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
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
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase tracking-normal text-slate-500">{hotelName}</p>
              <h1 className="truncate text-lg font-semibold">{activeSection}</h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isStaffPortalRoute ? <StaffPortalHeaderActions currentUser={currentUser} hotelId={hotelId} /> : null}
            <HeaderUserPill currentUser={currentUser} />
            <NotificationBell hotelId={hotelId} />
            <span className="hidden rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 sm:inline-flex">
              Live sync
            </span>
            <Button
              aria-label="Sign out"
              className="sm:hidden"
              size="icon"
              type="button"
              variant="ghost"
              onClick={() => {
                logout();
                router.replace("/login");
              }}
            >
              <LogOut />
            </Button>
            <Button
              className="hidden sm:inline-flex"
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
        </header>

        <main className="grid min-w-0 w-full gap-6 p-4 lg:p-6 2xl:p-8">{children}</main>
      </div>
      <DispatchAlert hotelId={hotelId} />
    </div>
  );
}

function HeaderUserPill({ currentUser }: { currentUser: CurrentUser | null }) {
  if (!currentUser) {
    return null;
  }

  return (
    <div className="hidden min-w-0 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 md:flex">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#0F3D91]/10 text-xs font-semibold text-[#0F3D91]">
        {currentUser.name?.[0]?.toUpperCase() ?? "U"}
      </div>
      <div className="min-w-0">
        <p className="max-w-36 truncate text-xs font-semibold leading-4 text-slate-900">{currentUser.name}</p>
        <p className="max-w-36 truncate text-[10px] leading-3 text-slate-500">
          {titleCase(currentUser.job_role ?? currentUser.staff_level ?? "Hotel team")}
        </p>
      </div>
    </div>
  );
}

function StaffPortalHeaderActions({
  hotelId,
  currentUser,
}: {
  hotelId: string;
  currentUser: CurrentUser | null;
}) {
  const shifts = useShifts(hotelId);
  const updateShift = useUpdateShift(hotelId);
  const today = new Date().toISOString().slice(0, 10);
  const currentShift = useMemo(() => {
    const todayShifts = (shifts.data ?? []).filter(
      (shift) => shift.user_id === currentUser?.id && shift.shift_date === today,
    );

    return todayShifts.find((shift) => !["completed", "on_leave"].includes(shift.status)) ?? todayShifts[0];
  }, [currentUser?.id, shifts.data, today]);

  async function updateShiftStatus(shift: EmployeeShift, status: "checked_in" | "completed") {
    try {
      await updateShift.mutateAsync({
        shiftId: shift.id,
        payload: {
          status,
          actual_start: status === "checked_in" ? new Date().toISOString() : shift.actual_start,
          actual_end: status === "completed" ? new Date().toISOString() : shift.actual_end,
        },
      });
      toast.success(status === "checked_in" ? "Checked in" : "Checked out");
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  if (shifts.isLoading) {
    return <span className="hidden rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500 md:inline-flex">Shift loading</span>;
  }

  if (!currentShift) {
    return (
      <Button className="h-8 px-2 text-xs sm:px-3" disabled type="button" variant="secondary">
        <LogIn />
        <span className="hidden sm:inline">No shift</span>
      </Button>
    );
  }

  if (currentShift.status === "checked_in") {
    return (
      <Button
        aria-label="Check out"
        className="h-8 px-2 text-xs sm:px-3"
        disabled={updateShift.isPending}
        type="button"
        variant="secondary"
        onClick={() => updateShiftStatus(currentShift, "completed")}
      >
        <LogOut />
        <span className="hidden sm:inline">Check out</span>
      </Button>
    );
  }

  if (["completed", "on_leave"].includes(currentShift.status)) {
    return (
      <span className="hidden rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 sm:inline-flex">
        {titleCase(currentShift.status)}
      </span>
    );
  }

  return (
    <Button
      aria-label="Check in"
      className="h-8 px-2 text-xs sm:px-3"
      disabled={updateShift.isPending}
      type="button"
      onClick={() => updateShiftStatus(currentShift, "checked_in")}
    >
      <LogIn />
      <span className="hidden sm:inline">Check in</span>
    </Button>
  );
}

function canAccessNavItem(item: NavItem, currentUser: CurrentUser | null, isHotelAdmin: boolean) {
  if (!currentUser) {
    return false;
  }
  if (currentUser.is_hotel_owner) {
    return true;
  }
  if (item.adminOnly && !isHotelAdmin) {
    return false;
  }
  if (!item.permissions?.length) {
    return true;
  }
  const permissions = new Set(currentUser.permissions ?? []);
  return item.permissions.some((permission) => permissions.has(permission));
}

function isSessionExpiredError(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const status = error.response?.status ?? 0;
  const message = apiErrorDetails(error).message.toLowerCase();

  if (status === 429 || message.includes("rate limit")) {
    return false;
  }

  return status === 401 || status === 403;
}
