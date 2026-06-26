"use client";

import { format } from "date-fns";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataState } from "@/components/ui/data-state";
import { compactId, titleCase } from "@/lib/utils";
import type { Ticket } from "@/types/domain";
import { useTicketAcceptances, useTicketEscalations } from "@/features/tickets/hooks/useTickets";

export function TicketDetailDialog({ hotelId, tickets }: { hotelId: string; tickets: Ticket[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ticketId = searchParams.get("ticketId");
  const ticket = tickets.find((item) => item.id === ticketId);
  const acceptances = useTicketAcceptances(hotelId, ticketId);
  const escalations = useTicketEscalations(hotelId, ticketId);

  function close() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("ticketId");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <Dialog open={Boolean(ticketId)} onOpenChange={(open) => (!open ? close() : undefined)}>
      <DialogContent className="left-auto right-0 top-0 h-screen max-h-screen w-full max-w-xl translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none border-y-0 border-r-0 p-0 sm:w-[32rem]">
        <DialogHeader className="border-b border-slate-200 p-5">
          <DialogTitle>{ticket?.ticket_code ?? "Ticket details"}</DialogTitle>
          <DialogDescription>{ticket ? ticket.item_description : "Ticket was not found in the current list."}</DialogDescription>
        </DialogHeader>

        {ticket ? (
          <div className="grid gap-5 p-5">
            <section className="grid gap-3 sm:grid-cols-2">
              <Detail label="Stage" value={titleCase(ticket.stage)} />
              <Detail label="Priority" value={`P${ticket.priority}`} />
              <Detail label="Assigned" value={ticket.assigned_to_name ?? compactId(ticket.assigned_to)} />
              <Detail label="Room" value={ticket.room_number ? `Room ${ticket.room_number}` : compactId(ticket.room_id)} />
              <Detail label="Reservation" value={ticket.reservation_no ?? compactId(ticket.reservation_id)} />
              <Detail label="Conversation" value={compactId(ticket.conversation_id)} />
              <Detail label="Source" value={titleCase(ticket.source)} />
              <Detail label="Created" value={format(new Date(ticket.created_at), "dd MMM, HH:mm")} />
            </section>

            <section className="grid gap-4">
              <div className="rounded-md border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Acceptance Flow</h3>
                  <Badge>{acceptances.data?.length ?? 0}</Badge>
                </div>
                {acceptances.isLoading ? <DataState isLoading /> : null}
                {acceptances.data?.length ? (
                  <div className="grid gap-2">
                    {acceptances.data.map((item) => (
                      <div className="rounded bg-slate-50 p-3 text-sm" key={item.id}>
                        <p className="font-medium">{compactId(item.offered_to)}</p>
                        <p className="text-slate-500">
                          {titleCase(item.response)} after {item.expire_after_minutes} min window
                        </p>
                      </div>
                    ))}
                  </div>
                ) : !acceptances.isLoading ? (
                  <p className="text-sm text-slate-500">No acceptance records yet.</p>
                ) : null}
              </div>

              <div className="rounded-md border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Escalations</h3>
                  <Badge>{escalations.data?.length ?? 0}</Badge>
                </div>
                {escalations.isLoading ? <DataState isLoading /> : null}
                {escalations.data?.length ? (
                  <div className="grid gap-2">
                    {escalations.data.map((item) => (
                      <div className="rounded bg-slate-50 p-3 text-sm" key={item.id}>
                        <p className="font-medium">Level {item.escalation_level ?? item.level}</p>
                        <p className="text-slate-500">{item.reason}</p>
                      </div>
                    ))}
                  </div>
                ) : !escalations.isLoading ? (
                  <p className="text-sm text-slate-500">No escalations recorded.</p>
                ) : null}
              </div>
            </section>

            <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end border-t border-slate-200 bg-white p-4">
              <Button asChild type="button">
                <Link href={`/${hotelId}/tickets/${ticket.id}`}>Open full page</Link>
              </Button>
            </div>
          </div>
        ) : (
          <DataState empty emptyTitle="Select a ticket from the board to inspect its workflow history." />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-slate-950">{value}</p>
    </div>
  );
}
