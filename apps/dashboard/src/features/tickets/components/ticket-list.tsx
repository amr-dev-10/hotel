"use client";

import { useMemo } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowUpRight, Hotel, MessageSquare, Timer, UserCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { compactId, titleCase } from "@/lib/utils";
import type { Ticket } from "@/types/domain";
import { TicketDetailDialog } from "@/features/tickets/components/ticket-detail-dialog";
import { useTickets } from "@/features/tickets/hooks/useTickets";

export function TicketList({ hotelId }: { hotelId: string }) {
  const searchParams = useSearchParams();
  const filters = useMemo(
    () => ({
      q: searchParams.get("q") ?? "",
      stage: searchParams.get("stage") ?? "",
      priority: searchParams.get("priority") ?? "",
      assigned_to: searchParams.get("assigned_to") ?? "",
      department_key: searchParams.get("department_key") ?? "",
      sla_status: searchParams.get("sla_status") ?? "",
    }),
    [searchParams],
  );
  const tickets = useTickets(hotelId, filters);
  const rows = tickets.data ?? [];

  if (tickets.isLoading) {
    return <DataState isLoading />;
  }

  if (tickets.error) {
    return <DataState error={tickets.error} />;
  }

  if (!rows.length) {
    return (
      <>
        <DataState empty emptyTitle="No tickets match this view." />
        <TicketDetailDialog hotelId={hotelId} tickets={tickets.data ?? []} />
      </>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-md border border-slate-200 bg-white lg:block">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-normal text-slate-500">
            <tr>
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">SLA</th>
              <th className="px-4 py-3">Assigned</th>
              <th className="px-4 py-3">Context</th>
              <th className="px-4 py-3 text-right">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((ticket) => (
              <TicketRow hotelId={hotelId} key={ticket.id} ticket={ticket} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {rows.map((ticket) => (
          <MobileTicketCard hotelId={hotelId} key={ticket.id} ticket={ticket} />
        ))}
      </div>

      {tickets.hasNextPage ? (
        <div className="mt-3 flex justify-center">
          <Button disabled={tickets.isFetchingNextPage} type="button" variant="secondary" onClick={() => tickets.fetchNextPage()}>
            {tickets.isFetchingNextPage ? "Loading..." : "Load more"}
          </Button>
        </div>
      ) : null}

      <TicketDetailDialog hotelId={hotelId} tickets={tickets.data ?? []} />
    </>
  );
}

function TicketRow({ hotelId, ticket }: { hotelId: string; ticket: Ticket }) {
  const openPreview = useOpenPreview(ticket.id);

  return (
    <tr className="cursor-pointer align-top transition-colors hover:bg-slate-50" onClick={openPreview}>
      <td className="px-4 py-3">
        <p className="font-semibold text-slate-950">{ticket.ticket_code}</p>
        <p className="mt-1 line-clamp-2 max-w-[24rem] text-slate-600">{ticket.item_description}</p>
        <p className="mt-2 text-xs text-slate-400">{format(new Date(ticket.created_at), "dd MMM, HH:mm")}</p>
      </td>
      <td className="px-4 py-3">
        <Badge variant={stageVariant(ticket.stage)}>{titleCase(ticket.stage)}</Badge>
      </td>
      <td className="px-4 py-3">
        <PriorityBadge priority={ticket.priority} />
      </td>
      <td className="px-4 py-3 text-slate-600">
        {ticket.sla_due_at ? (
          <span className="inline-flex items-center gap-2">
            <Timer className="size-4 text-slate-400" />
            {formatDistanceToNow(new Date(ticket.sla_due_at), { addSuffix: true })}
          </span>
        ) : (
          "Not started"
        )}
      </td>
      <td className="px-4 py-3 text-slate-600">
        <span className="inline-flex items-center gap-2">
          <UserCheck className="size-4 text-slate-400" />
          {compactId(ticket.assigned_to)}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-600">
        <div className="grid gap-1">
          <span className="inline-flex items-center gap-2">
            <Hotel className="size-4 text-slate-400" />
            {compactId(ticket.room_id)}
          </span>
          <span className="inline-flex items-center gap-2">
            <MessageSquare className="size-4 text-slate-400" />
            {titleCase(ticket.source)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <Button asChild size="sm" type="button" variant="ghost" onClick={(event) => event.stopPropagation()}>
          <Link href={`/${hotelId}/tickets/${ticket.id}`}>
            <ArrowUpRight />
          </Link>
        </Button>
      </td>
    </tr>
  );
}

function MobileTicketCard({ hotelId, ticket }: { hotelId: string; ticket: Ticket }) {
  const openPreview = useOpenPreview(ticket.id);

  return (
    <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm" onClick={openPreview}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">{ticket.ticket_code}</p>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{ticket.item_description}</p>
        </div>
        <Button asChild size="icon" type="button" variant="ghost" onClick={(event) => event.stopPropagation()}>
          <Link href={`/${hotelId}/tickets/${ticket.id}`} aria-label="Open full ticket">
            <ArrowUpRight />
          </Link>
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant={stageVariant(ticket.stage)}>{titleCase(ticket.stage)}</Badge>
        <PriorityBadge priority={ticket.priority} />
        <Badge>{titleCase(ticket.source)}</Badge>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-500">
        <span className="flex items-center gap-2">
          <Timer className="size-3.5" />
          {ticket.sla_due_at
            ? `Due ${formatDistanceToNow(new Date(ticket.sla_due_at), { addSuffix: true })}`
            : "SLA not started"}
        </span>
        <span className="flex items-center gap-2">
          <UserCheck className="size-3.5" />
          {compactId(ticket.assigned_to)}
        </span>
      </div>
    </article>
  );
}

function useOpenPreview(ticketId: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return () => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("ticketId", ticketId);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
}

function PriorityBadge({ priority }: { priority: number }) {
  if (priority >= 4) {
    return <Badge variant="rose">P{priority}</Badge>;
  }

  if (priority === 3) {
    return <Badge variant="amber">P{priority}</Badge>;
  }

  return <Badge variant="teal">P{priority}</Badge>;
}

function stageVariant(stage: string) {
  const normalized = normalizeStage(stage);
  if (normalized === "approved") {
    return "green";
  }
  if (normalized === "pending_approval") {
    return "amber";
  }
  if (normalized === "pending_accept") {
    return "blue";
  }
  return "default";
}

function normalizeStage(stage: string) {
  if (["Open", "created"].includes(stage)) {
    return "created";
  }
  if (["accepted", "reopened"].includes(stage)) {
    return "accepted";
  }
  if (["approved", "Completed"].includes(stage)) {
    return "approved";
  }
  return stage;
}
