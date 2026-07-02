"use client";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { CreateReservationDialog } from "@/features/reservations/components/create-reservation-dialog";
import { ReservationsTable } from "@/features/reservations/components/reservations-table";

export function ReservationsPage({ hotelId }: { hotelId: string }) {
  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <PageBreadcrumbs
          current="Reservations"
          description="Manage arrivals, departures, and room assignment state."
          hotelId={hotelId}
        />
        <CreateReservationDialog hotelId={hotelId} />
      </div>
      <ReservationsTable hotelId={hotelId} />
    </div>
  );
}
