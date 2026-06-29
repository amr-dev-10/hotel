"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { CheckCircle2, Clock3, LogIn, LogOut, ThumbsDown, ThumbsUp, TicketCheck } from "lucide-react";
import { toast } from "sonner";
import { showApiErrorToast } from "@/lib/api/error-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { useShifts, useUpdateShift } from "@/features/staff/hooks/useStaff";
import { useAcceptTicket, useCompleteTicket, useRejectTicket, useTickets } from "@/features/tickets/hooks/useTickets";
import { titleCase } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import type { EmployeeShift, Ticket } from "@/types/domain";

export function StaffPortalPage({ hotelId }: { hotelId: string }) {
  const currentUser = useAuthStore((state) => state.currentUser);
  const tickets = useTickets(hotelId, {
    assigned_to: currentUser?.id ?? "",
    limit: "100",
  });
  const shifts = useShifts(hotelId);
  const updateShift = useUpdateShift(hotelId);
  const acceptTicket = useAcceptTicket(hotelId);
  const rejectTicket = useRejectTicket(hotelId);
  const completeTicket = useCompleteTicket(hotelId);

  const assignedTickets = useMemo(
    () => (tickets.data ?? []).filter((ticket) => ticket.assigned_to === currentUser?.id),
    [currentUser?.id, tickets.data],
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
  const today = new Date().toISOString().slice(0, 10);
  const todayShifts = useMemo(
    () => (shifts.data ?? []).filter((shift) => shift.user_id === currentUser?.id && shift.shift_date === today),
    [currentUser?.id, shifts.data, today],
  );
  const currentShift = todayShifts.find((shift) => !["completed", "on_leave"].includes(shift.status)) ?? todayShifts[0];

  if (!currentUser) {
    return <DataState empty emptyTitle="Sign in required." />;
  }

  if (tickets.isLoading || shifts.isLoading) {
    return <DataState isLoading />;
  }

  if (tickets.error || shifts.error) {
    return <DataState error={tickets.error ?? shifts.error} />;
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

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Staff Portal</h2>
          <p className="text-sm text-slate-500">{currentUser.name}</p>
        </div>
        {currentShift ? (
          <div className="flex flex-wrap gap-2">
            {currentShift.status !== "checked_in" && currentShift.status !== "completed" ? (
              <Button disabled={updateShift.isPending} type="button" onClick={() => updateShiftStatus(currentShift, "checked_in")}>
                <LogIn />
                Check in
              </Button>
            ) : null}
            {currentShift.status === "checked_in" ? (
              <Button disabled={updateShift.isPending} type="button" variant="secondary" onClick={() => updateShiftStatus(currentShift, "completed")}>
                <LogOut />
                Check out
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric icon={<TicketCheck />} label="Active" value={activeTickets.length} />
        <Metric icon={<Clock3 />} label="Pending accept" value={pendingTickets.length} />
        <Metric icon={<CheckCircle2 />} label="Due soon" value={dueSoonTickets.length} />
        <Metric icon={<LogIn />} label="Shift" value={currentShift ? titleCase(currentShift.status) : "None"} />
      </div>

      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Today</h3>
          {currentShift ? <Badge variant={shiftVariant(currentShift.status)}>{shiftTime(currentShift)}</Badge> : <Badge>No shift</Badge>}
        </div>
        {currentShift ? (
          <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
            <Info label="Status" value={titleCase(currentShift.status)} />
            <Info label="Start" value={timeLabel(currentShift.actual_start ?? currentShift.shift_start)} />
            <Info label="End" value={timeLabel(currentShift.actual_end ?? currentShift.shift_end)} />
          </div>
        ) : (
          <p className="text-sm text-slate-500">No shift scheduled for today.</p>
        )}
      </section>

      <section className="grid gap-3">
        <h3 className="text-base font-semibold">Assigned Tickets</h3>
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
          <Link className="font-semibold text-slate-950 hover:text-[#0F3D91]" href={`/${hotelId}/tickets/${ticket.id}`}>
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

function normalizeStage(stage: string) {
  return stage.toLowerCase().replaceAll(" ", "_");
}

function isClosed(ticket: Ticket) {
  return ["approved", "completed", "closed", "resolved", "cancelled"].includes(normalizeStage(ticket.stage));
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
  if (["checked_in", "completed"].includes(status)) {
    return "green";
  }
  if (status === "scheduled") {
    return "blue";
  }
  if (status === "late") {
    return "amber";
  }
  if (["absent", "on_leave"].includes(status)) {
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
