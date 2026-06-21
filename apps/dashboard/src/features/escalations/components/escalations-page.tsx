"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, ArrowUpRight, Clock, ShieldAlert, UserCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { useEscalatedTickets } from "@/features/escalations/hooks/useEscalations";
import { cn, compactId, titleCase } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import type { EscalatedTicket } from "@/types/domain";

export function EscalationsPage({ hotelId }: { hotelId: string }) {
  const currentUser = useAuthStore((state) => state.currentUser);
  const isAdmin = Boolean(
    currentUser?.is_hotel_owner ||
      currentUser?.user_type === "HOTEL_ADMIN" ||
      currentUser?.staff_level === "admin",
  );
  const [scope, setScope] = useState(isAdmin ? "all" : "department");
  const escalations = useEscalatedTickets(hotelId, scope);

  useEffect(() => {
    if (isAdmin && scope === "department") {
      setScope("all");
    }
    if (!isAdmin && scope === "all") {
      setScope("department");
    }
  }, [isAdmin, scope]);

  const metrics = useMemo(() => {
    const rows = escalations.data ?? [];
    return {
      total: rows.length,
      critical: rows.filter((item) => item.ticket.priority >= 4).length,
      pending: rows.filter((item) => item.ticket.stage === "pending_accept").length,
    };
  }, [escalations.data]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div>
          <h2 className="text-xl font-semibold">Escalations</h2>
          <p className="text-sm text-slate-500">Monitor tickets that moved beyond normal dispatch or SLA handling.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin ? (
            <ScopeButton active={scope === "all"} label="All escalations" onClick={() => setScope("all")} />
          ) : null}
          <ScopeButton active={scope === "department"} label="Department" onClick={() => setScope("department")} />
          <ScopeButton active={scope === "mine"} label="Mine" onClick={() => setScope("mine")} />
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <Metric icon={<ShieldAlert />} label="Escalated tickets" value={metrics.total} />
        <Metric icon={<AlertTriangle />} label="Priority 4+" value={metrics.critical} />
        <Metric icon={<Clock />} label="Pending accept" value={metrics.pending} />
      </section>

      {escalations.isLoading ? <DataState isLoading /> : null}
      {escalations.error ? <DataState error={escalations.error} /> : null}
      {!escalations.isLoading && !escalations.data?.length ? (
        <DataState empty emptyTitle="No escalated tickets in this view." />
      ) : null}

      {escalations.data?.length ? (
        <section className="grid gap-3">
          {escalations.data.map((item) => (
            <EscalationCard hotelId={hotelId} item={item} key={item.escalation_id} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function EscalationCard({ hotelId, item }: { hotelId: string; item: EscalatedTicket }) {
  return (
    <article className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[1fr_auto] xl:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={item.escalation_level >= 3 ? "rose" : "amber"}>
            {item.escalation_level > 0 ? `Level ${item.escalation_level}` : "Pending accept"}
          </Badge>
          <Badge variant={item.ticket.priority >= 4 ? "rose" : "blue"}>P{item.ticket.priority}</Badge>
          <Badge>{titleCase(item.ticket.stage)}</Badge>
          <span className="text-xs text-slate-500">
            {formatDistanceToNowStrict(new Date(item.escalated_at), { addSuffix: true })}
          </span>
        </div>
        <h3 className="mt-3 truncate text-base font-semibold text-slate-950">{item.ticket.ticket_code}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.ticket.item_description}</p>
        <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-4">
          <Detail label="Reason" value={titleCase(item.reason)} />
          <Detail label="Assigned" value={item.ticket.assigned_to_name ?? compactId(item.ticket.assigned_to)} />
          <Detail label="Escalated to" value={item.escalated_to_name ?? compactId(item.escalated_to)} />
          <Detail label="Room" value={item.ticket.room_number ? `Room ${item.ticket.room_number}` : compactId(item.ticket.room_id)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 xl:justify-end">
        <Button asChild type="button" variant="secondary">
          <Link href={`/${hotelId}/tickets/${item.ticket_id}`}>
            <ArrowUpRight />
            Open ticket
          </Link>
        </Button>
      </div>
    </article>
  );
}

function ScopeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <Button
      className={cn(active && "border-[#0F3D91]/30 bg-[#0F3D91]/5 text-[#0F3D91]")}
      type="button"
      variant="secondary"
      onClick={onClick}
    >
      <UserCheck />
      {label}
    </Button>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex size-9 items-center justify-center rounded-md bg-[#0F3D91]/10 text-[#0F3D91] [&_svg]:size-4">
          {icon}
        </span>
        <span className="text-xs font-semibold uppercase tracking-normal text-slate-400">{label}</span>
      </div>
      <p className="mt-4 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-semibold uppercase tracking-normal text-slate-400">{label}</p>
      <p className="mt-1 truncate text-slate-700">{value}</p>
    </div>
  );
}
