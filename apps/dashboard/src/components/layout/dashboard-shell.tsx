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
  ChevronDown,
  CircleHelp,
  LogIn,
  Gauge,
  GitBranch,
  ListChecks,
  LogOut,
  Menu,
  MessageCircle,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const activeNavItem = useMemo(
    () => allNavItems.find((item) => pathname === `/${hotelId}/${item.href}` || pathname?.startsWith(`/${hotelId}/${item.href}/`)),
    [allNavItems, hotelId, pathname],
  );
  const activeSection = activeNavItem?.label ?? "Dashboard";
  const sidebarPreferenceKey = currentUser?.id
    ? `arcadia-sidebar-collapsed:${currentUser.id}`
    : `arcadia-sidebar-collapsed:${hotelId}`;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const updateSidebarCollapsed = useCallback(
    (collapsed: boolean) => {
      setSidebarCollapsed(collapsed);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(sidebarPreferenceKey, collapsed ? "true" : "false");
      }
    },
    [sidebarPreferenceKey],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") {
      return;
    }

    setSidebarCollapsed(window.localStorage.getItem(sidebarPreferenceKey) === "true");
  }, [mounted, sidebarPreferenceKey]);

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

  const isStaffPortalRoute = pathname === `/${hotelId}/staff-portal` || pathname?.startsWith(`/${hotelId}/staff-portal/`);
  const hotelName = hotelQuery.data?.name ?? "Arcadia";
  const sidebarWidthClass = sidebarCollapsed ? "lg:w-[4.75rem] lg:hover:w-[17rem]" : "lg:w-[17rem]";
  const contentOffsetClass = sidebarCollapsed ? "lg:pl-[4.75rem]" : "lg:pl-[17rem]";
  const sidebarTextClass = sidebarCollapsed ? "lg:opacity-0 lg:group-hover/sidebar:opacity-100" : "";
  const ActiveModuleIcon = activeNavItem?.icon ?? Gauge;

  if (!mounted) {
    return <div className="min-h-screen bg-[var(--background)]" />;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--background)] text-[var(--foreground)]">
      <aside
        className={cn(
          "group/sidebar fixed inset-y-0 left-0 z-40 flex w-[calc(100vw-1rem)] max-w-80 -translate-x-full flex-col overflow-hidden border-r border-white/10 bg-[var(--background-deep)] text-white shadow-2xl transition-[transform,width] duration-200 ease-out sm:w-80 lg:translate-x-0",
          sidebarWidthClass,
          sidebarOpen && "translate-x-0",
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-[var(--primary)] text-white shadow-[var(--shadow-control)]">
            <BedDouble className="size-5" />
          </div>
          <div className={cn("min-w-0 whitespace-nowrap transition-opacity duration-150", sidebarTextClass)}>
            <p className="truncate text-sm font-semibold uppercase tracking-[0.18em]">Arcadia</p>
            <p className="truncate text-xs text-white/55">Hotel Platform</p>
          </div>
        </div>

        <nav className="arcadia-sidebar-scroll grid min-h-0 flex-1 content-start gap-1 overflow-y-auto p-3">
          <p className={cn("px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-normal text-white/35 transition-opacity duration-150", sidebarTextClass)}>
            Operations
          </p>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const href = `/${hotelId}/${item.href}`;
            const active = pathname === href || pathname?.startsWith(`${href}/`);

            return (
              <Link
                className={cn(
                  "flex h-10 items-center gap-3 overflow-hidden rounded-md px-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white",
                  active && "bg-[var(--primary)] text-white shadow-[0_10px_22px_rgba(37,99,235,0.28)] hover:bg-[var(--primary-hover)] hover:text-white",
                )}
                href={href}
                key={item.href}
                onClick={() => setSidebarOpen(false)}
                prefetch={false}
              >
                <Icon className="size-4 shrink-0" />
                <span className={cn("whitespace-nowrap transition-opacity duration-150", sidebarTextClass)}>
                  {item.label}
                </span>
              </Link>
            );
          })}
          <p className={cn("px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-normal text-white/35 transition-opacity duration-150", sidebarTextClass)}>
            Settings
          </p>
          {visibleSettingsNavItems.map((item) => {
            const Icon = item.icon;
            const href = `/${hotelId}/${item.href}`;
            const active = pathname === href || pathname?.startsWith(`${href}/`);

            return (
              <Link
                className={cn(
                  "flex h-10 items-center gap-3 overflow-hidden rounded-md px-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white",
                  active && "bg-[var(--primary)] text-white shadow-[0_10px_22px_rgba(37,99,235,0.28)] hover:bg-[var(--primary-hover)] hover:text-white",
                )}
                href={href}
                key={item.href}
                onClick={() => setSidebarOpen(false)}
                prefetch={false}
              >
                <Icon className="size-4 shrink-0" />
                <span className={cn("whitespace-nowrap transition-opacity duration-150", sidebarTextClass)}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 p-3">
          <div className="overflow-hidden rounded-md border border-white/10 bg-white/[0.06] p-3 shadow-[0_14px_30px_rgba(2,6,23,0.24)]">
            <span
              className={cn(
                "hidden size-7 items-center justify-center rounded-md bg-white/10 text-xs font-semibold text-white",
                sidebarCollapsed && "lg:flex lg:group-hover/sidebar:hidden",
              )}
            >
              {hotelName[0]?.toUpperCase() ?? "H"}
            </span>
            <div className={cn("whitespace-nowrap transition-opacity duration-150", sidebarTextClass)}>
              <p className="text-xs font-semibold uppercase tracking-normal text-white/40">Current Hotel</p>
              <p className="mt-1 truncate text-sm font-semibold text-white">{hotelName}</p>
              <p className="mt-0.5 truncate text-xs text-white/55">{titleCase(currentUser?.job_role ?? "Hotel team")}</p>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-[2px] lg:hidden"
          type="button"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className={cn("min-w-0 overflow-x-hidden transition-[padding] duration-200 ease-out", contentOffsetClass)}>
        <header className="sticky top-0 z-20 flex min-h-16 min-w-0 items-center justify-between gap-2 border-b border-white/10 bg-[linear-gradient(90deg,#08111f_0%,#0f172a_48%,#101c31_100%)] px-3 py-2 text-white shadow-[0_14px_34px_rgba(2,6,23,0.18)] sm:gap-3 sm:px-4 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <Button
              aria-label="Open navigation"
              className="text-white hover:bg-white/10 hover:text-white lg:hidden"
              data-tooltip="Open navigation"
              size="icon"
              type="button"
              variant="ghost"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu />
            </Button>
            <Button
              aria-label={sidebarCollapsed ? "Keep navigation open" : "Collapse navigation"}
              className="hidden text-white/80 hover:bg-white/10 hover:text-white lg:inline-flex"
              data-tooltip={sidebarCollapsed ? "Keep navigation open" : "Collapse navigation"}
              size="icon"
              type="button"
              variant="ghost"
              onClick={() => updateSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
            <div className="hidden h-9 w-px bg-white/10 sm:block" />
            <div className="flex h-10 min-w-0 max-w-[52vw] items-center gap-2 rounded-md border border-white/12 bg-white/[0.055] px-2.5 shadow-[0_10px_24px_rgba(2,6,23,0.16)] sm:max-w-none">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--primary)] text-white shadow-[0_8px_18px_rgba(37,99,235,0.28)]">
                <ActiveModuleIcon className="size-4" />
              </span>
              <span className="truncate text-sm font-semibold text-white">{activeSection}</span>
            </div>
          </div>

          <div className="flex min-w-0 shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/[0.06] p-1 shadow-[0_12px_30px_rgba(2,6,23,0.2)]">
            {isStaffPortalRoute ? <StaffPortalHeaderActions currentUser={currentUser} hotelId={hotelId} /> : null}
            <span className="hidden h-8 items-center rounded-md bg-[var(--success-soft)] px-3 text-xs font-semibold text-[var(--success)] lg:inline-flex">
              Live sync
            </span>
            <NotificationBell hotelId={hotelId} triggerClassName="size-8 text-white/80 hover:bg-white/10 hover:text-white" />
            <Button
              aria-label="Help and support"
              className="hidden size-8 text-white/80 hover:bg-white/10 hover:text-white sm:inline-flex"
              data-tooltip="Help and support"
              size="icon"
              type="button"
              variant="ghost"
              onClick={() => toast.info("Help center is not configured yet")}
            >
              <CircleHelp />
            </Button>
            <HeaderUserMenu
              currentUser={currentUser}
              hotelName={hotelName}
              onOpenProfile={() => router.push(`/${hotelId}/settings/profile`)}
              onSignOut={() => {
                logout();
                router.replace("/login");
              }}
            />
          </div>
        </header>

        <main className="mx-auto grid w-full max-w-[1800px] min-w-0 gap-5 overflow-x-hidden p-3 sm:p-4 lg:gap-6 lg:p-6 2xl:p-8">{children}</main>
      </div>
      <DispatchAlert hotelId={hotelId} />
    </div>
  );
}

function HeaderUserMenu({
  currentUser,
  hotelName,
  onOpenProfile,
  onSignOut,
}: {
  currentUser: CurrentUser | null;
  hotelName: string;
  onOpenProfile: () => void;
  onSignOut: () => void;
}) {
  if (!currentUser) {
    return null;
  }

  const role = titleCase(currentUser.job_role ?? currentUser.staff_level ?? "Hotel team");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-10 min-w-0 items-center gap-2 rounded-md px-1.5 pr-2 text-left text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          type="button"
        >
          <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/95 text-xs font-semibold text-[var(--background-deep)] ring-1 ring-white/20">
            {currentUser.name?.[0]?.toUpperCase() ?? "U"}
          </span>
          <span className="hidden min-w-0 md:block">
            <span className="block max-w-36 truncate text-xs font-semibold leading-4 text-white">{currentUser.name}</span>
            <span className="block max-w-36 truncate text-[10px] leading-3 text-white/58">{role}</span>
          </span>
          <ChevronDown className="hidden size-4 shrink-0 text-white/55 md:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64 p-2">
        <div className="flex items-center gap-3 rounded-md bg-[var(--panel-muted)] p-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-semibold text-white">
            {currentUser.name?.[0]?.toUpperCase() ?? "U"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{currentUser.name}</p>
            <p className="truncate text-xs text-[var(--muted)]">{role}</p>
          </div>
        </div>
        <div className="px-2 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-normal text-[var(--muted)]">Current hotel</p>
          <p className="mt-0.5 truncate text-xs font-medium text-[var(--foreground)]">{hotelName}</p>
        </div>
        <DropdownMenuSeparator className="my-1 h-px bg-[var(--border)]" />
        <DropdownMenuItem onSelect={onOpenProfile}>
          <UserCircle />
          Profile settings
        </DropdownMenuItem>
        <div className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-[var(--success)]">
          <span className="size-2 rounded-full bg-[var(--success)]" />
          Live sync active
        </div>
        <DropdownMenuSeparator className="my-1 h-px bg-[var(--border)]" />
        <DropdownMenuItem className="text-[var(--destructive)] focus:text-[var(--destructive)]" onSelect={onSignOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
    return <span className="hidden rounded bg-white/10 px-2 py-1 text-xs font-semibold text-white/70 md:inline-flex">Shift loading</span>;
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
      <span className="hidden rounded bg-[var(--success-soft)] px-2 py-1 text-xs font-semibold text-[var(--success)] sm:inline-flex">
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
