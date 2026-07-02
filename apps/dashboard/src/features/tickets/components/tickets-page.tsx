"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { CreateTicketDialog } from "@/features/tickets/components/create-ticket-dialog";
import { TicketBoard } from "@/features/tickets/components/ticket-board";
import { TicketFilters } from "@/features/tickets/components/ticket-filters";
import { TicketList } from "@/features/tickets/components/ticket-list";
import { Can } from "@/lib/auth/can";

export function TicketsPage({ hotelId }: { hotelId: string }) {
  return (
    <div className="grid min-w-0 gap-5">
      <div className="flex min-w-0 flex-col justify-between gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-end">
        <PageBreadcrumbs
          current="Tickets"
          description="Drag requests between workflow stages or use actions for acceptance and approval."
          hotelId={hotelId}
        />
        <Can I="create" a="Ticket">
          <CreateTicketDialog hotelId={hotelId} />
        </Can>
      </div>
      <Suspense>
        <TicketWorkspace hotelId={hotelId} />
      </Suspense>
    </div>
  );
}

function TicketWorkspace({ hotelId }: { hotelId: string }) {
  const searchParams = useSearchParams();
  const activeView = searchParams.get("view") ?? "list";

  return (
    <div className="grid min-w-0 gap-4">
      <TicketFilters />
      {activeView === "kanban" ? (
        <>
          <div className="hidden min-w-0 md:block">
            <TicketBoard hotelId={hotelId} />
          </div>
          <div className="min-w-0 md:hidden">
            <TicketList hotelId={hotelId} />
          </div>
        </>
      ) : (
        <TicketList hotelId={hotelId} />
      )}
    </div>
  );
}
