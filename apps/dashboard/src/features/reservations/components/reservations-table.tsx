"use client";

import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { format } from "date-fns";
import { LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { apiErrorMessage } from "@/lib/api/client";
import { compactId, titleCase } from "@/lib/utils";
import type { Reservation } from "@/types/domain";
import {
  useCheckInReservation,
  useCheckOutReservation,
  useReservations,
} from "@/features/reservations/hooks/useReservations";

const columnHelper = createColumnHelper<Reservation>();

export function ReservationsTable({ hotelId }: { hotelId: string }) {
  const reservations = useReservations(hotelId);
  const checkIn = useCheckInReservation(hotelId);
  const checkOut = useCheckOutReservation(hotelId);

  const columns = [
    columnHelper.accessor("reservation_no", {
      header: "Reservation",
      cell: (info) => <span className="font-semibold">{info.getValue()}</span>,
    }),
    columnHelper.accessor("guest_id", {
      header: "Guest",
      cell: (info) => compactId(info.getValue()),
    }),
    columnHelper.accessor("room_id", {
      header: "Room",
      cell: (info) => compactId(info.getValue()),
    }),
    columnHelper.accessor("checkin_date", {
      header: "Check-in",
      cell: (info) => format(new Date(info.getValue()), "dd MMM yyyy"),
    }),
    columnHelper.accessor("checkout_date", {
      header: "Check-out",
      cell: (info) => format(new Date(info.getValue()), "dd MMM yyyy"),
    }),
    columnHelper.accessor("status", {
      header: "Status",
      cell: (info) => <Badge variant={statusVariant(info.getValue())}>{titleCase(info.getValue())}</Badge>,
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            type="button"
            variant="secondary"
            onClick={async () => {
              try {
                await checkIn.mutateAsync(row.original.id);
                toast.success("Reservation checked in");
              } catch (error) {
                toast.error(apiErrorMessage(error));
              }
            }}
          >
            <LogIn />
            Check in
          </Button>
          <Button
            size="sm"
            type="button"
            variant="secondary"
            onClick={async () => {
              try {
                await checkOut.mutateAsync(row.original.id);
                toast.success("Reservation checked out");
              } catch (error) {
                toast.error(apiErrorMessage(error));
              }
            }}
          >
            <LogOut />
            Check out
          </Button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: reservations.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (reservations.isLoading) {
    return <DataState isLoading />;
  }

  if (reservations.error) {
    return <DataState error={reservations.error} />;
  }

  if (!reservations.data?.length) {
    return <DataState empty emptyTitle="No reservations yet." />;
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-normal text-slate-500">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold" key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr className="border-b border-slate-100 last:border-0" key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td className="px-4 py-3 align-middle" key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function statusVariant(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("check") || normalized.includes("stay")) {
    return "green";
  }
  if (normalized.includes("cancel")) {
    return "rose";
  }
  if (normalized.includes("book")) {
    return "blue";
  }
  return "default";
}
