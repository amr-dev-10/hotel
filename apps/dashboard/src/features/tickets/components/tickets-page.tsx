"use client";

import { Suspense } from "react";

import { CreateTicketDialog } from "@/features/tickets/components/create-ticket-dialog";
import { TicketBoard } from "@/features/tickets/components/ticket-board";
import { TicketFilters } from "@/features/tickets/components/ticket-filters";

export function TicketsPage({ hotelId }: { hotelId: string }) {
  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Tickets</h2>
          <p className="text-sm text-slate-500">Drag requests between workflow stages or use actions for acceptance and approval.</p>
        </div>
        <CreateTicketDialog hotelId={hotelId} />
      </div>
      <Suspense>
        <TicketFilters />
        <TicketBoard hotelId={hotelId} />
      </Suspense>
    </div>
  );
}
