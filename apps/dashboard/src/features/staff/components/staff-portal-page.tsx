"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  BedDouble,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  Clock3,
  DoorOpen,
  House,
  LogIn,
  LogOut,
  Plus,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TicketCheck,
  Utensils,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { useRestaurantOrders } from "@/features/fnb/hooks/useFnb";
import { useHousekeeping } from "@/features/housekeeping/hooks/useHousekeeping";
import { useReservations } from "@/features/reservations/hooks/useReservations";
import { useRooms } from "@/features/rooms/hooks/useRooms";
import { useShifts, useUpdateShift } from "@/features/staff/hooks/useStaff";
import { useAcceptTicket, useCompleteTicket, useRejectTicket, useTickets } from "@/features/tickets/hooks/useTickets";
import { showApiErrorToast } from "@/lib/api/error-toast";
import { titleCase } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import type { EmployeeShift, HousekeepingTask, Reservation, RestaurantOrder, Room, Ticket } from "@/types/domain";

export function StaffPortalPage({ hotelId }: { hotelId: string }) {
  const currentUser = useAuthStore((state) => state.currentUser);
  const assignedTicketQuery = useTickets(hotelId, {
    assigned_to: currentUser?.id ?? "",
    limit: "100",
  });
  const allTickets = useTickets(hotelId, { limit: "200" });
  const shifts = useShifts(hotelId);
  const reservations = useReservations(hotelId, { limit: 200 });
  const rooms = useRooms(hotelId);
  const housekeeping = useHousekeeping(hotelId);
  const orders = useRestaurantOrders(hotelId);
  const updateShift = useUpdateShift(hotelId);
  const acceptTicket = useAcceptTicket(hotelId);
  const rejectTicket = useRejectTicket(hotelId);
  const completeTicket = useCompleteTicket(hotelId);

  const today = new Date().toISOString().slice(0, 10);

  const assignedTickets = useMemo(
    () => (assignedTicketQuery.data ?? []).filter((ticket) => ticket.assigned_to === currentUser?.id),
    [currentUser?.id, assignedTicketQuery.data],
  );
  const pendingTickets = assignedTickets.filter((ticket) => normalizeStage(ticket.stage) === "pending_accept");
  const activeTickets = assignedTickets.filter((ticket) => !isClosed(ticket));
  const dueSoonTickets = activeTickets.filter((ticket) => {
    if (!ticket.sla_due_at) {
      return false;
    }
    const minutes = (new Date(ticket.sla_due_at).getTime() - Date.now()) / 60000;
    return minutes <= 15;
  });

  const todayShifts = useMemo(
    () => (shifts.data ?? []).filter((shift) => shift.user_id === currentUser?.id && dateOnly(shift.shift_date) === today),
    [currentUser?.id, shifts.data, today],
  );
  const currentShift = todayShifts.find((shift) => !["completed", "on_leave"].includes(normalizeStage(shift.status))) ?? todayShifts[0];

  const operationalTickets = allTickets.data.length ? allTickets.data : assignedTickets;
  const operations = buildOperationsOverview({
    reservations: reservations.data ?? [],
    rooms: rooms.data ?? [],
    tickets: operationalTickets,
    today,
  });
  const roomStats = buildRoomsOverview(rooms.data ?? []);
  const departmentRows = buildDepartmentStatus({
    hotelId,
    housekeeping: housekeeping.data ?? [],
    orders: orders.data ?? [],
    shifts: shifts.data ?? [],
    tickets: operationalTickets,
    today,
  });

  if (!currentUser) {
    return <DataState empty emptyTitle="Sign in required." />;
  }

  if (assignedTicketQuery.isLoading || shifts.isLoading) {
    return <DataState isLoading />;
  }

  if (assignedTicketQuery.error || shifts.error) {
    return <DataState error={assignedTicketQuery.error ?? shifts.error} />;
  }

  async function handleAccept(ticketId: string) {
    try {
      await acceptTicket.mutateAsync(ticketId);
      toast.success("Ticket accepted");
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  async function handleReject(ticketId: string) {
    try {
      await rejectTicket.mutateAsync(ticketId);
      toast.success("Ticket rejected");
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  async function handleComplete(ticketId: string) {
    try {
      await completeTicket.mutateAsync(ticketId);
      toast.success("Ticket sent for approval");
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  async function handleShiftStatus(shift: EmployeeShift, status: "checked_in" | "completed") {
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

  const operationalError = allTickets.error ?? reservations.error ?? rooms.error ?? housekeeping.error ?? orders.error;

  return (
    <div className="grid gap-5">
      <PageBreadcrumbs
        current="Staff Portal"
        description={`${currentUser.name}'s shift, tickets, and live hotel operations.`}
        hotelId={hotelId}
        items={[{ label: "Staff Portal", href: `/${hotelId}/staff-portal` }]}
        srTitle="Staff Portal"
      />

      {operationalError ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Some operational dashboard data is unavailable for this account. Personal shift and assigned tickets remain available.
        </div>
      ) : null}

      <PersonalOverview
        activeTickets={activeTickets.length}
        currentShift={currentShift}
        dueSoonTickets={dueSoonTickets.length}
        pendingTickets={pendingTickets.length}
        updatePending={updateShift.isPending}
        onShiftUpdate={handleShiftStatus}
      />

      <OperationsOverview
        checkIns={reservations.error ? "N/A" : operations.checkIns}
        checkOuts={reservations.error ? "N/A" : operations.checkOuts}
        occupancy={rooms.error ? "N/A" : `${operations.occupancy}%`}
        pendingTickets={allTickets.error ? "N/A" : operations.pendingTickets}
      />

      <section className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
        <RoomsOverview error={rooms.error} stats={roomStats} />
        <div className="grid gap-5">
          <QuickActionsGrid hotelId={hotelId} />
          <DepartmentStatusList items={departmentRows} />
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Assigned Tickets</h3>
          <Badge>{activeTickets.length} active</Badge>
        </div>
        {activeTickets.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {activeTickets.map((ticket) => (
              <TicketCard
                hotelId={hotelId}
                isMutating={acceptTicket.isPending || rejectTicket.isPending || completeTicket.isPending}
                key={ticket.id}
                ticket={ticket}
                onAccept={handleAccept}
                onComplete={handleComplete}
                onReject={handleReject}
              />
            ))}
          </div>
        ) : (
          <DataState empty emptyTitle="No active assigned tickets." />
        )}
      </section>
    </div>
  );
}

function PersonalOverview({
  activeTickets,
  currentShift,
  dueSoonTickets,
  pendingTickets,
  updatePending,
  onShiftUpdate,
}: {
  activeTickets: number;
  currentShift: EmployeeShift | undefined;
  dueSoonTickets: number;
  pendingTickets: number;
  updatePending: boolean;
  onShiftUpdate: (shift: EmployeeShift, status: "checked_in" | "completed") => void;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
      <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-semibold">Today</h3>
            <p className="text-sm text-slate-500">Shift status and check-in controls</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {currentShift ? <Badge variant={shiftVariant(currentShift.status)}>{shiftTime(currentShift)}</Badge> : <Badge>No shift</Badge>}
            <ShiftAction
              isPending={updatePending}
              shift={currentShift}
              onUpdate={onShiftUpdate}
            />
          </div>
        </div>
        {currentShift ? (
          <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
            <Info label="Status" value={titleCase(currentShift.status)} />
            <Info label="Start" value={timeLabel(currentShift.actual_start ?? currentShift.shift_start)} />
            <Info label="End" value={timeLabel(currentShift.actual_end ?? currentShift.shift_end)} />
          </div>
        ) : (
          <p className="text-sm text-slate-500">No shift is scheduled for your account today, so check-in is not available yet.</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric icon={<TicketCheck />} label="My Active" value={activeTickets} />
        <Metric icon={<Clock3 />} label="Need Accept" value={pendingTickets} />
        <Metric icon={<CheckCircle2 />} label="Due Soon" value={dueSoonTickets} />
      </div>
    </section>
  );
}

function OperationsOverview({
  checkIns,
  checkOuts,
  occupancy,
  pendingTickets,
}: {
  checkIns: string | number;
  checkOuts: string | number;
  occupancy: string | number;
  pendingTickets: string | number;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Today Overview</h3>
        <Badge variant="blue">Live operations</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<CalendarCheck2 />} label="Check-ins" value={checkIns} />
        <Metric icon={<CalendarDays />} label="Check-outs" value={checkOuts} />
        <Metric icon={<BedDouble />} label="Occupancy" value={occupancy} />
        <Metric icon={<TicketCheck />} label="Pending Tickets" value={pendingTickets} />
      </div>
    </section>
  );
}

function RoomsOverview({ error, stats }: { error: Error | null; stats: RoomStats }) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Rooms Overview</h3>
        <Badge variant={error ? "amber" : "green"}>{error ? "Unavailable" : `${stats.total} rooms`}</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Metric icon={<House />} label="Total Rooms" value={error ? "N/A" : stats.total} />
        <Metric icon={<BedDouble />} label="Occupied" value={error ? "N/A" : stats.occupied} />
        <Metric icon={<DoorOpen />} label="Vacant" value={error ? "N/A" : stats.vacant} />
        <Metric icon={<Sparkles />} label="Out of Order" value={error ? "N/A" : stats.outOfOrder} />
      </div>
    </section>
  );
}

function DepartmentStatusList({ items }: { items: DepartmentStatusItem[] }) {
  return (
    <section className="grid gap-3">
      <h3 className="text-base font-semibold">Department Status</h3>
      <div className="grid gap-2">
        {items.map((item) => (
          <Link
            className="flex min-h-16 items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
            href={item.href}
            key={item.label}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-700 [&_svg]:size-5">
              {item.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-900">{item.label}</span>
              <span className="block truncate text-xs text-slate-500">{item.helper}</span>
            </span>
            <Badge variant={item.variant}>{item.value}</Badge>
            <ArrowRight className="size-4 text-slate-400" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function QuickActionsGrid({ hotelId }: { hotelId: string }) {
  const actions = [
    { label: "Create Ticket", href: `/${hotelId}/tickets`, icon: <Plus /> },
    { label: "Reservations", href: `/${hotelId}/reservations`, icon: <CalendarDays /> },
    { label: "Guests", href: `/${hotelId}/guests`, icon: <Users /> },
    { label: "Kitchen", href: `/${hotelId}/kitchen`, icon: <ChefHat /> },
  ];

  return (
    <section className="grid gap-3">
      <h3 className="text-base font-semibold">Quick Actions</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {actions.map((action) => (
          <Link
            className="flex min-h-12 items-center gap-3 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
            href={action.href}
            key={action.label}
          >
            <span className="[&_svg]:size-4">{action.icon}</span>
            <span className="min-w-0 flex-1 truncate">{action.label}</span>
            <ArrowRight className="size-4 text-slate-400" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function ShiftAction({
  shift,
  isPending,
  onUpdate,
}: {
  shift: EmployeeShift | undefined;
  isPending: boolean;
  onUpdate: (shift: EmployeeShift, status: "checked_in" | "completed") => void;
}) {
  if (!shift) {
    return (
      <Button className="h-8 text-xs" disabled type="button" variant="secondary">
        <LogIn />
        No shift today
      </Button>
    );
  }

  const status = normalizeStage(shift.status);

  if (status === "checked_in") {
    return (
      <Button
        className="h-8 text-xs"
        disabled={isPending}
        type="button"
        variant="secondary"
        onClick={() => onUpdate(shift, "completed")}
      >
        <LogOut />
        Check out
      </Button>
    );
  }

  if (["completed", "on_leave"].includes(status)) {
    return (
      <Button className="h-8 text-xs" disabled type="button" variant="secondary">
        <CheckCircle2 />
        {titleCase(status)}
      </Button>
    );
  }

  return (
    <Button className="h-8 text-xs" disabled={isPending} type="button" onClick={() => onUpdate(shift, "checked_in")}>
      <LogIn />
      Check in
    </Button>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
        <span className="text-slate-500 [&_svg]:size-4">{icon}</span>
      </div>
      <p className="mt-2 truncate text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-400">{label}</p>
      <p className="mt-1 font-medium text-slate-700">{value}</p>
    </div>
  );
}

function TicketCard({
  hotelId,
  ticket,
  isMutating,
  onAccept,
  onReject,
  onComplete,
}: {
  hotelId: string;
  ticket: Ticket;
  isMutating: boolean;
  onAccept: (ticketId: string) => void;
  onReject: (ticketId: string) => void;
  onComplete: (ticketId: string) => void;
}) {
  const stage = normalizeStage(ticket.stage);

  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link className="font-semibold text-slate-950 hover:text-[var(--primary)]" href={`/${hotelId}/tickets/${ticket.id}`}>
            {ticket.ticket_code}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{ticket.item_description}</p>
        </div>
        <Badge variant={stageVariant(stage)}>{titleCase(stage)}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        <Badge>P{ticket.priority}</Badge>
        {ticket.sla_due_at ? <Badge>Due {formatDistanceToNow(new Date(ticket.sla_due_at), { addSuffix: true })}</Badge> : null}
        {ticket.room_number ? <Badge>Room {ticket.room_number}</Badge> : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {stage === "pending_accept" ? (
          <>
            <Button disabled={isMutating} size="sm" type="button" onClick={() => onAccept(ticket.id)}>
              <ThumbsUp />
              Accept
            </Button>
            <Button disabled={isMutating} size="sm" type="button" variant="secondary" onClick={() => onReject(ticket.id)}>
              <ThumbsDown />
              Reject
            </Button>
          </>
        ) : null}
        {["accepted", "in_progress", "reopened"].includes(stage) ? (
          <Button disabled={isMutating} size="sm" type="button" onClick={() => onComplete(ticket.id)}>
            <CheckCircle2 />
            Complete
          </Button>
        ) : null}
      </div>
    </article>
  );
}

type OperationsStats = {
  checkIns: number;
  checkOuts: number;
  occupancy: number;
  pendingTickets: number;
};

type RoomStats = {
  total: number;
  occupied: number;
  vacant: number;
  outOfOrder: number;
};

type DepartmentStatusItem = {
  href: string;
  icon: ReactNode;
  label: string;
  helper: string;
  value: string | number;
  variant: "green" | "amber" | "blue" | "rose" | "default";
};

function buildOperationsOverview({
  reservations,
  rooms,
  tickets,
  today,
}: {
  reservations: Reservation[];
  rooms: Room[];
  tickets: Ticket[];
  today: string;
}): OperationsStats {
  const checkIns = reservations.filter((reservation) => dateOnly(reservation.checkin_date) === today).length;
  const checkOuts = reservations.filter((reservation) => dateOnly(reservation.checkout_date) === today).length;
  const occupied = rooms.filter((room) => isOccupiedRoom(room)).length;
  const occupancy = rooms.length ? Math.round((occupied / rooms.length) * 100) : 0;
  const pendingTickets = tickets.filter((ticket) => !isClosed(ticket)).length;

  return {
    checkIns,
    checkOuts,
    occupancy,
    pendingTickets,
  };
}

function buildRoomsOverview(rooms: Room[]): RoomStats {
  return {
    total: rooms.length,
    occupied: rooms.filter((room) => isOccupiedRoom(room)).length,
    vacant: rooms.filter((room) => isVacantRoom(room)).length,
    outOfOrder: rooms.filter((room) => isOutOfOrderRoom(room)).length,
  };
}

function buildDepartmentStatus({
  hotelId,
  housekeeping,
  orders,
  shifts,
  tickets,
  today,
}: {
  hotelId: string;
  housekeeping: HousekeepingTask[];
  orders: RestaurantOrder[];
  shifts: EmployeeShift[];
  tickets: Ticket[];
  today: string;
}): DepartmentStatusItem[] {
  const pendingHousekeeping = housekeeping.filter((task) => !["completed", "done"].includes(normalizeStage(task.status))).length;
  const openTickets = tickets.filter((ticket) => !isClosed(ticket)).length;
  const activeOrders = orders.filter((order) => !["delivered", "completed", "cancelled", "void"].includes(normalizeStage(order.status))).length;
  const checkedInStaff = shifts.filter((shift) => dateOnly(shift.shift_date) === today && normalizeStage(shift.status) === "checked_in").length;

  return [
    {
      href: `/${hotelId}/housekeeping`,
      icon: <Sparkles />,
      label: "Housekeeping",
      helper: "Pending cleaning and room tasks",
      value: pendingHousekeeping,
      variant: pendingHousekeeping ? "amber" : "green",
    },
    {
      href: `/${hotelId}/tickets`,
      icon: <TicketCheck />,
      label: "Tickets",
      helper: "Open guest and internal requests",
      value: openTickets,
      variant: openTickets ? "blue" : "green",
    },
    {
      href: `/${hotelId}/fnb`,
      icon: <Utensils />,
      label: "F&B Service",
      helper: "Active restaurant orders",
      value: activeOrders,
      variant: activeOrders ? "amber" : "green",
    },
    {
      href: `/${hotelId}/settings/staff`,
      icon: <Users />,
      label: "Staff",
      helper: "Checked in today",
      value: checkedInStaff,
      variant: checkedInStaff ? "green" : "default",
    },
  ];
}

function normalizeStage(stage: string) {
  return stage.toLowerCase().replaceAll(" ", "_");
}

function normalizeValue(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[\s-]+/g, "_");
}

function dateOnly(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function isClosed(ticket: Ticket) {
  return ["approved", "completed", "closed", "resolved", "cancelled"].includes(normalizeStage(ticket.stage));
}

function isOccupiedRoom(room: Room) {
  return normalizeValue(room.status) === "occupied";
}

function isVacantRoom(room: Room) {
  return ["vacant", "available", "clean"].includes(normalizeValue(room.status));
}

function isOutOfOrderRoom(room: Room) {
  return ["out_of_order", "maintenance", "blocked", "unavailable"].includes(normalizeValue(room.status));
}

function stageVariant(stage: string): "green" | "amber" | "blue" | "rose" | "default" {
  if (["approved", "completed", "closed", "resolved"].includes(stage)) {
    return "green";
  }
  if (stage === "pending_accept") {
    return "blue";
  }
  if (stage === "pending_approval") {
    return "amber";
  }
  if (stage === "cancelled") {
    return "rose";
  }
  return "default";
}

function shiftVariant(status: string): "green" | "amber" | "blue" | "rose" | "default" {
  const normalized = normalizeStage(status);
  if (["checked_in", "completed"].includes(normalized)) {
    return "green";
  }
  if (normalized === "scheduled") {
    return "blue";
  }
  if (normalized === "late") {
    return "amber";
  }
  if (["absent", "on_leave"].includes(normalized)) {
    return "rose";
  }
  return "default";
}

function shiftTime(shift: EmployeeShift) {
  return `${timeLabel(shift.shift_start)} - ${timeLabel(shift.shift_end)}`;
}

function timeLabel(value: string) {
  const normalized = value.includes("T") ? value : `2026-01-01T${value}`;
  return format(new Date(normalized), "HH:mm");
}
