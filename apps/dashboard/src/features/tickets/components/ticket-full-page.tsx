"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ArrowLeft, CheckCircle2, Loader2, MessageCircle, RotateCcw, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Textarea } from "@/components/ui/textarea";
import { Can } from "@/lib/auth/can";
import { apiErrorMessage } from "@/lib/api/client";
import { compactId, titleCase } from "@/lib/utils";
import {
  useAcceptTicket,
  useApproveTicket,
  useCreateTicketMessage,
  useCompleteTicket,
  useRejectTicket,
  useReopenTicket,
  useTicketAcceptances,
  useTicketEscalations,
  useTicketTimeline,
  useTickets,
} from "@/features/tickets/hooks/useTickets";

export function TicketFullPage({
  hotelId,
  ticketId,
}: {
  hotelId: string;
  ticketId: string;
}) {
  const filters = useMemo(() => ({}), []);
  const tickets = useTickets(hotelId, filters);
  const acceptances = useTicketAcceptances(hotelId, ticketId);
  const escalations = useTicketEscalations(hotelId, ticketId);
  const timeline = useTicketTimeline(hotelId, ticketId);
  const acceptTicket = useAcceptTicket(hotelId);
  const rejectTicket = useRejectTicket(hotelId);
  const completeTicket = useCompleteTicket(hotelId);
  const approveTicket = useApproveTicket(hotelId);
  const reopenTicket = useReopenTicket(hotelId);
  const createTicketMessage = useCreateTicketMessage(hotelId, ticketId);
  const [reopenNote, setReopenNote] = useState("");
  const [discussionMessage, setDiscussionMessage] = useState("");
  const ticket = tickets.data?.find((item) => item.id === ticketId);

  async function runAction(action: () => Promise<unknown>, label: string) {
    try {
      await action();
      toast.success(label);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  async function handlePostMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!discussionMessage.trim()) {
      return;
    }
    try {
      await createTicketMessage.mutateAsync({ content: discussionMessage.trim(), sender_type: "staff" });
      setDiscussionMessage("");
      toast.success("Message posted");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  if (tickets.isLoading) {
    return <DataState isLoading />;
  }

  if (tickets.error) {
    return <DataState error={tickets.error} />;
  }

  if (!ticket) {
    return <DataState empty emptyTitle="Ticket not found." />;
  }

  const busy =
    acceptTicket.isPending ||
    rejectTicket.isPending ||
    completeTicket.isPending ||
    approveTicket.isPending ||
    reopenTicket.isPending;

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Button asChild type="button" variant="ghost">
            <Link href={`/${hotelId}/tickets`}>
              <ArrowLeft />
              Tickets
            </Link>
          </Button>
          <h2 className="mt-2 text-xl font-semibold">{ticket.ticket_code}</h2>
          <p className="text-sm text-slate-500">{ticket.item_description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={ticket.priority >= 4 ? "rose" : "blue"}>P{ticket.priority}</Badge>
          <Badge variant={ticket.stage === "approved" ? "green" : "amber"}>{titleCase(ticket.stage)}</Badge>
        </div>
      </div>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          <Can I="accept" a="Ticket">
            <Button disabled={busy} type="button" onClick={() => runAction(() => acceptTicket.mutateAsync(ticket.id), "Ticket accepted")}>
              {acceptTicket.isPending ? <Loader2 className="animate-spin" /> : <ThumbsUp />}
              Accept
            </Button>
            <Button disabled={busy} type="button" variant="secondary" onClick={() => runAction(() => rejectTicket.mutateAsync(ticket.id), "Ticket rejected")}>
              {rejectTicket.isPending ? <Loader2 className="animate-spin" /> : <ThumbsDown />}
              Reject
            </Button>
          </Can>
          <Can I="edit" a="Ticket">
            <Button disabled={busy} type="button" variant="secondary" onClick={() => runAction(() => completeTicket.mutateAsync(ticket.id), "Ticket completed")}>
              {completeTicket.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              Complete
            </Button>
          </Can>
          <Can I="approve" a="Ticket">
            <Button disabled={busy} type="button" onClick={() => runAction(() => approveTicket.mutateAsync(ticket.id), "Ticket approved")}>
              {approveTicket.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              Approve
            </Button>
          </Can>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="grid gap-4">
          <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-3">
            <Detail label="SLA" value={ticket.sla_due_at ? formatDistanceToNowStrict(new Date(ticket.sla_due_at), { addSuffix: true }) : "Not set"} />
            <Detail label="Assigned to" value={compactId(ticket.assigned_to)} />
            <Detail label="Department" value={compactId(ticket.department_id)} />
            <Detail label="Room" value={compactId(ticket.room_id)} />
            <Detail label="Reservation" value={compactId(ticket.reservation_id)} />
            <Detail label="Conversation" value={compactId(ticket.conversation_id)} />
            <Detail label="Source" value={titleCase(ticket.source)} />
            <Detail label="Created" value={format(new Date(ticket.created_at), "dd MMM yyyy, HH:mm")} />
          </section>

          <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
            <h3 className="text-base font-semibold">Reopen Note</h3>
            <Textarea value={reopenNote} onChange={(event) => setReopenNote(event.target.value)} />
            <div className="flex justify-end">
              <Can I="approve" a="Ticket">
                <Button
                  disabled={busy}
                  type="button"
                  variant="secondary"
                  onClick={() => runAction(() => reopenTicket.mutateAsync({ ticketId: ticket.id, note: reopenNote || undefined }), "Ticket reopened")}
                >
                  {reopenTicket.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                  Reopen
                </Button>
              </Can>
            </div>
          </section>

          <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="size-4 text-[#0F3D91]" />
                <h3 className="text-base font-semibold">Internal Discussion</h3>
              </div>
              <Badge>{timeline.data?.length ?? 0}</Badge>
            </div>

            {timeline.isLoading ? <DataState isLoading /> : null}
            {timeline.error ? <DataState error={timeline.error} /> : null}
            {!timeline.isLoading && !timeline.data?.length ? (
              <p className="text-sm text-slate-500">No ticket activity yet.</p>
            ) : null}
            {timeline.data?.length ? (
              <div className="grid max-h-[34rem] gap-3 overflow-y-auto pr-1">
                {timeline.data.map((item) => (
                  <div
                    className={item.item_type === "message" ? "rounded-md border border-blue-100 bg-blue-50/50 p-3" : "rounded-md border border-slate-200 bg-slate-50 p-3"}
                    key={`${item.item_type}-${item.id}`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <Badge variant={item.item_type === "message" ? "blue" : "default"}>
                        {item.item_type === "message" ? titleCase(item.sender_type ?? "staff") : titleCase(item.event_type ?? "event")}
                      </Badge>
                      <span className="text-xs text-slate-500">{format(new Date(item.created_at), "dd MMM, HH:mm")}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-800">{item.content}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <form className="grid gap-3 border-t border-slate-100 pt-3" onSubmit={handlePostMessage}>
              <Textarea
                placeholder="Post an internal update for the staff working this ticket..."
                value={discussionMessage}
                onChange={(event) => setDiscussionMessage(event.target.value)}
              />
              <div className="flex justify-end">
                <Button disabled={createTicketMessage.isPending || !discussionMessage.trim()} type="submit">
                  {createTicketMessage.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                  Post message
                </Button>
              </div>
            </form>
          </section>
        </div>

        <div className="grid gap-4">
          <HistoryPanel
            count={acceptances.data?.length ?? 0}
            isLoading={acceptances.isLoading}
            title="Acceptance History"
          >
            {(acceptances.data ?? []).map((item) => (
              <div className="rounded bg-slate-50 p-3 text-sm" key={item.id}>
                <p className="font-medium">{compactId(item.offered_to)}</p>
                <p className="text-slate-500">
                  {titleCase(item.response)} in {item.expire_after_minutes} min window
                </p>
              </div>
            ))}
          </HistoryPanel>

          <HistoryPanel
            count={escalations.data?.length ?? 0}
            isLoading={escalations.isLoading}
            title="Escalation Log"
          >
            {(escalations.data ?? []).map((item) => (
              <div className="rounded bg-slate-50 p-3 text-sm" key={item.id}>
                <p className="font-medium">Level {item.escalation_level ?? item.level}</p>
                <p className="text-slate-500">{item.reason}</p>
              </div>
            ))}
          </HistoryPanel>
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function HistoryPanel({
  title,
  count,
  isLoading,
  children,
}: {
  title: string;
  count: number;
  isLoading: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
        <Badge>{count}</Badge>
      </div>
      {isLoading ? <DataState isLoading /> : null}
      {!isLoading && count === 0 ? <p className="text-sm text-slate-500">No records yet.</p> : null}
      {children}
    </section>
  );
}
