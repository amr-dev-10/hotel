"use client";

import { useMemo } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, CheckCircle2, Clock3, TicketCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { titleCase } from "@/lib/utils";
import { useDepartments } from "@/features/departments/hooks/useDepartments";
import { useStaff } from "@/features/staff/hooks/useStaff";
import { useTickets } from "@/features/tickets/hooks/useTickets";
import type { Ticket } from "@/types/domain";

const ticketFilters = {};

export function StaffWorkloadPage({ hotelId }: { hotelId: string }) {
  const staff = useStaff(hotelId);
  const departments = useDepartments(hotelId);
  const tickets = useTickets(hotelId, ticketFilters);
  const departmentById = useMemo(
    () => new Map((departments.data ?? []).map((department) => [department.id, department.name])),
    [departments.data],
  );
  const ticketsByUser = useMemo(() => {
    const grouped = new Map<string, Ticket[]>();
    (tickets.data ?? []).forEach((ticket) => {
      if (!ticket.assigned_to) {
        return;
      }
      grouped.set(ticket.assigned_to, [...(grouped.get(ticket.assigned_to) ?? []), ticket]);
    });
    return grouped;
  }, [tickets.data]);
  const rows = useMemo(
    () =>
      (staff.data ?? [])
        .map((user) => ({ user, tickets: ticketsByUser.get(user.id) ?? [] }))
        .sort((a, b) => openTickets(b.tickets) - openTickets(a.tickets)),
    [staff.data, ticketsByUser],
  );
  const allTickets = tickets.data ?? [];

  if (staff.isLoading || departments.isLoading || tickets.isLoading) {
    return <DataState isLoading />;
  }

  if (staff.error || departments.error || tickets.error) {
    return <DataState error={staff.error ?? departments.error ?? tickets.error} />;
  }

  return (
    <div className="grid gap-5">
      <div>
        <Button asChild type="button" variant="ghost">
          <Link href={`/${hotelId}/settings/staff`}>
            <ArrowLeft />
            Staff
          </Link>
        </Button>
        <h2 className="mt-2 text-xl font-semibold">Ticket Workload</h2>
        <p className="text-sm text-slate-500">Assigned tickets, closures, escalation pressure, and SLA risk.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric icon={Clock3} label="Open tickets" value={openTickets(allTickets)} />
        <Metric icon={CheckCircle2} label="Closed today" value={allTickets.filter((ticket) => ticket.resolved_at && isToday(ticket.resolved_at)).length} />
        <Metric icon={Activity} label="Escalated" value={allTickets.filter(isTicketEscalated).length} />
        <Metric icon={TicketCheck} label="Avg resolution" value={averageResolutionLabel(allTickets)} />
      </div>

      <section className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <div className="grid min-w-[920px] grid-cols-[1fr_150px_110px_110px_120px_140px_140px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
          <span>Employee</span>
          <span>Department</span>
          <span>Open</span>
          <span>Closed</span>
          <span>Escalated</span>
          <span>Avg resolution</span>
          <span>Status</span>
        </div>
        {rows.length ? (
          rows.map(({ user, tickets: assigned }) => (
            <div
              className="grid min-w-[920px] grid-cols-[1fr_150px_110px_110px_120px_140px_140px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
              key={user.id}
            >
              <Link className="min-w-0 hover:text-[#0F3D91]" href={`/${hotelId}/settings/staff/${user.id}/tickets`} prefetch={false}>
                <p className="truncate font-semibold">{user.name}</p>
                <p className="truncate text-xs text-slate-500">{user.job_role ?? titleCase(user.staff_level)}</p>
              </Link>
              <span className="truncate text-slate-600">
                {user.department_id ? departmentById.get(user.department_id) ?? "None" : "None"}
              </span>
              <span className="font-semibold">{openTickets(assigned)}</span>
              <span className="font-semibold">{closedTickets(assigned)}</span>
              <span className="font-semibold">{assigned.filter(isTicketEscalated).length}</span>
              <span className="truncate text-slate-600">{averageResolutionLabel(assigned)}</span>
              <Badge variant={workloadVariant(assigned)}>{titleCase(workloadLabel(assigned))}</Badge>
            </div>
          ))
        ) : (
          <DataState empty emptyTitle="No staff records for workload." />
        )}
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
        <Icon className="size-4 text-slate-500" />
      </div>
      <p className="mt-2 truncate text-2xl font-semibold">{value}</p>
    </div>
  );
}

function isTicketClosed(ticket: Ticket) {
  return Boolean(ticket.resolved_at) || ["approved", "completed", "closed"].includes(ticket.stage.toLowerCase());
}

function isTicketEscalated(ticket: Ticket) {
  return ticket.priority >= 4 || ticket.stage.toLowerCase().includes("escalat");
}

function openTickets(tickets: Ticket[]) {
  return tickets.filter((ticket) => !isTicketClosed(ticket)).length;
}

function closedTickets(tickets: Ticket[]) {
  return tickets.length - openTickets(tickets);
}

function workloadLabel(tickets: Ticket[]) {
  const open = openTickets(tickets);
  if (open === 0) {
    return "clear";
  }
  if (open <= 2) {
    return "light";
  }
  if (open <= 5) {
    return "steady";
  }
  return "heavy";
}

function workloadVariant(tickets: Ticket[]): "green" | "blue" | "amber" | "rose" {
  const label = workloadLabel(tickets);
  if (label === "clear") {
    return "green";
  }
  if (label === "light") {
    return "blue";
  }
  if (label === "steady") {
    return "amber";
  }
  return "rose";
}

function averageResolutionLabel(tickets: Ticket[]) {
  const resolvedDurations = tickets
    .filter((ticket) => ticket.resolved_at)
    .map((ticket) => Math.max(0, new Date(ticket.resolved_at as string).getTime() - new Date(ticket.created_at).getTime()));

  if (!resolvedDurations.length) {
    return "0m";
  }

  const averageMinutes = Math.round(resolvedDurations.reduce((sum, item) => sum + item, 0) / resolvedDurations.length / 60000);
  return averageMinutes >= 60 ? `${Math.round(averageMinutes / 60)}h` : `${averageMinutes}m`;
}

function isToday(value: string) {
  return new Date(value).toDateString() === new Date().toDateString();
}
