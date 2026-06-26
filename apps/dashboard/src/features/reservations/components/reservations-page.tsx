"use client";

import { CreateReservationDialog } from "@/features/reservations/components/create-reservation-dialog";
import { ReservationsTable } from "@/features/reservations/components/reservations-table";

export function ReservationsPage({ hotelId }: { hotelId: string }) {
  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Reservations</h2>
          <p className="text-sm text-slate-500">Manage arrivals, departures, and room assignment state.</p>
        </div>
        <CreateReservationDialog hotelId={hotelId} />
      </div>
      <ReservationsTable hotelId={hotelId} />
    </div>
  );
}
