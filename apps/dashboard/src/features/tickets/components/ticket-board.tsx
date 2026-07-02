"use client";

import { useEffect, useMemo, useState } from "react";
import { DndContext, type DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontal, Timer, UserCheck } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { showApiErrorToast } from "@/lib/api/error-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CursorPaginationControls } from "@/components/ui/cursor-pagination-controls";
import { DataState } from "@/components/ui/data-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Can } from "@/lib/auth/can";
import { cn, titleCase } from "@/lib/utils";
import type { Ticket } from "@/types/domain";
import {
  useAcceptTicket,
  useApproveTicket,
  useCompleteTicket,
  useTickets,
  useUpdateTicketStage,
} from "@/features/tickets/hooks/useTickets";
import { TicketDetailDialog } from "@/features/tickets/components/ticket-detail-dialog";

const PAGE_SIZE = 50;

const columns = [
  { key: "created", title: "Created", aliases: ["Open", "created"] },
  { key: "pending_accept", title: "Pending Accept", aliases: ["pending_accept"] },
  { key: "accepted", title: "Accepted", aliases: ["accepted", "reopened"] },
  { key: "in_progress", title: "In Progress", aliases: ["in_progress"] },
  { key: "pending_approval", title: "Pending Approval", aliases: ["pending_approval"] },
  { key: "approved", title: "Approved", aliases: ["approved", "Completed"] },
];

export function TicketBoard({ hotelId }: { hotelId: string }) {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const q = searchParams.get("q") ?? "";
  const stage = searchParams.get("stage") ?? "";
  const priority = searchParams.get("priority") ?? "";
  const assignedTo = searchParams.get("assigned_to") ?? "";
  const departmentKey = searchParams.get("department_key") ?? "";
  const slaStatus = searchParams.get("sla_status") ?? "";
  const filters = useMemo(
    () => ({
      q,
      stage,
      priority,
      assigned_to: assignedTo,
      department_key: departmentKey,
      sla_status: slaStatus,
      limit: String(PAGE_SIZE),
    }),
    [assignedTo, departmentKey, priority, q, slaStatus, stage],
  );
  const tickets = useTickets(hotelId, filters);
  const updateStage = useUpdateTicketStage(hotelId);
  const loadedPageCount = Math.max(1, tickets.pages.length);
  const rows = tickets.pages[page - 1] ?? [];

  useEffect(() => {
    setPage(1);
  }, [assignedTo, departmentKey, priority, q, slaStatus, stage]);

  useEffect(() => {
    if (page > loadedPageCount) {
      setPage(loadedPageCount);
    }
  }, [loadedPageCount, page]);

  async function handleNextPage() {
    if (page < tickets.pages.length) {
      setPage((current) => current + 1);
      return;
    }
    if (tickets.hasNextPage) {
      await tickets.fetchNextPage();
      setPage((current) => current + 1);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const ticket = event.active.data.current?.ticket as Ticket | undefined;
    const nextStage = event.over?.id.toString();
    if (!ticket || !nextStage || normalizeStage(ticket.stage) === nextStage) {
      return;
    }

    try {
      await updateStage.mutateAsync({ ticketId: ticket.id, stage: nextStage });
      toast.success("Ticket stage updated");
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  if (tickets.isLoading) {
    return <DataState isLoading />;
  }

  if (tickets.error) {
    return <DataState error={tickets.error} />;
  }

  return (
    <>
      <DndContext onDragEnd={handleDragEnd}>
        <div className="grid min-h-[640px] gap-4 overflow-x-auto pb-2 xl:grid-cols-6">
          {columns.map((column) => {
            const items = rows.filter((ticket) => column.aliases.includes(ticket.stage));
            return <BoardColumn columnKey={column.key} key={column.key} tickets={items} title={column.title} />;
          })}
        </div>
      </DndContext>
      <div className="mt-3">
        <CursorPaginationControls
          hasNextPage={tickets.hasNextPage}
          isFetchingNextPage={tickets.isFetchingNextPage}
          loadedPages={loadedPageCount}
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={tickets.totalItems}
          onNext={handleNextPage}
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
        />
      </div>
      <TicketDetailDialog hotelId={hotelId} tickets={tickets.data ?? []} />
    </>
  );
}

function BoardColumn({
  columnKey,
  title,
  tickets,
}: {
  columnKey: string;
  title: string;
  tickets: Ticket[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnKey });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "min-w-30 rounded-md border border-slate-200 bg-slate-50 p-3 transition-colors",
        isOver && "border-[var(--primary)] bg-[var(--primary-soft)]",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Badge variant="default">{tickets.length}</Badge>
      </div>
      <div className="flex flex-col gap-3">
        {tickets.length ? (
          tickets.map((ticket) => <DraggableTicketCard key={ticket.id} ticket={ticket} />)
        ) : (
          <div className="rounded-md border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
            Empty
          </div>
        )}
      </div>
    </section>
  );
}

function DraggableTicketCard({ ticket }: { ticket: Ticket }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket.id,
    data: { ticket },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <TicketCard ticket={ticket} isDragging={isDragging} />
    </div>
  );
}

function TicketCard({ ticket, isDragging }: { ticket: Ticket; isDragging: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const acceptTicket = useAcceptTicket(ticket.hotel_id);
  const completeTicket = useCompleteTicket(ticket.hotel_id);
  const approveTicket = useApproveTicket(ticket.hotel_id);

  function openDetail() {
    const next = new URLSearchParams(searchParams.toString());
    next.set("ticketId", ticket.id);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <article
      className={cn(
        "rounded-md border border-slate-200 bg-white p-3 shadow-sm transition-shadow",
        isDragging && "shadow-lg",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button className="min-w-0 text-left" type="button" onClick={openDetail}>
          <p className="truncate text-sm font-semibold text-slate-950">{ticket.ticket_code}</p>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{ticket.item_description}</p>
        </button>
        <TicketContextMenu
          onAccept={() => acceptTicket.mutate(ticket.id)}
          onApprove={() => approveTicket.mutate(ticket.id)}
          onComplete={() => completeTicket.mutate(ticket.id)}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <PriorityBadge priority={ticket.priority} />
        <Badge variant={stageVariant(ticket.stage)}>{titleCase(ticket.stage)}</Badge>
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
          {ticket.assigned_to_name ?? "Unassigned"}
        </span>
      </div>
    </article>
  );
}

function TicketContextMenu({
  onAccept,
  onComplete,
  onApprove,
}: {
  onAccept: () => void;
  onComplete: () => void;
  onApprove: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Ticket actions" size="icon" type="button" variant="ghost">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <Can I="accept" a="Ticket">
          <DropdownMenuItem onClick={onAccept}>Accept</DropdownMenuItem>
        </Can>
        <Can I="edit" a="Ticket">
          <DropdownMenuItem onClick={onComplete}>Mark complete</DropdownMenuItem>
        </Can>
        <Can I="approve" a="Ticket">
          <DropdownMenuItem onClick={onApprove}>Approve</DropdownMenuItem>
        </Can>
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
  const matched = columns.find((column) => column.aliases.includes(stage));
  return matched?.key ?? stage;
}
