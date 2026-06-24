"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { format } from "date-fns";
import { Ban, Eye, LogIn, LogOut, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CursorPaginationControls } from "@/components/ui/cursor-pagination-controls";
import { DataState } from "@/components/ui/data-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Can } from "@/lib/auth/can";
import { apiErrorMessage } from "@/lib/api/client";
import { titleCase } from "@/lib/utils";
import type { Reservation } from "@/types/domain";
import { CancelReservationDialog } from "@/features/reservations/components/cancel-reservation-dialog";
import {
  useCancelReservation,
  useCheckInReservation,
  useCheckOutReservation,
  useReservations,
} from "@/features/reservations/hooks/useReservations";

const columnHelper = createColumnHelper<Reservation>();
const PAGE_SIZE = 50;

export function ReservationsTable({ hotelId }: { hotelId: string }) {
  const [reservationToCancel, setReservationToCancel] = useState<Reservation | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const reservations = useReservations(hotelId, {
    q: search.trim() || undefined,
    status: status === "all" ? undefined : status,
    from: fromDate || undefined,
    to: toDate || undefined,
    limit: PAGE_SIZE,
  });
  const loadedPageCount = Math.max(1, reservations.pages.length);
  const rows = reservations.pages[page - 1] ?? [];
  const checkIn = useCheckInReservation(hotelId);
  const checkOut = useCheckOutReservation(hotelId);
  const cancelReservation = useCancelReservation(hotelId);

  useEffect(() => {
    setPage(1);
  }, [fromDate, search, status, toDate]);

  useEffect(() => {
    if (page > loadedPageCount) {
      setPage(loadedPageCount);
    }
  }, [loadedPageCount, page]);

  async function handleNextPage() {
    if (page < reservations.pages.length) {
      setPage((current) => current + 1);
      return;
    }
    if (reservations.hasNextPage) {
      await reservations.fetchNextPage();
      setPage((current) => current + 1);
    }
  }

  const columns = [
    columnHelper.accessor("reservation_no", {
      header: "Reservation",
      cell: (info) => (
        <Link
          className="font-semibold text-slate-950 hover:text-[#0F3D91]"
          href={`/${hotelId}/reservations/${info.row.original.id}`}
          prefetch={false}
        >
          {info.getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor("guest_id", {
      header: "Guest",
      cell: (info) => {
        return (
          <div className="min-w-0">
            <Link
              className="font-medium text-slate-900 hover:text-[#0F3D91]"
              href={`/${hotelId}/guests/${info.getValue()}`}
              prefetch={false}
            >
              {info.row.original.guest_name ?? "Unknown guest"}
            </Link>
            <p className="mt-0.5 text-xs text-slate-500">
              {info.row.original.guest_phone ?? "No phone"}
            </p>
          </div>
        );
      },
    }),
    columnHelper.accessor("room_id", {
      header: "Room",
      cell: (info) => {
        const reservation = info.row.original;
        if (reservation.room_number) {
          return `Room ${reservation.room_number}`;
        }
        return reservation.room_id ? "Assigned room" : "Assign later";
      },
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
      cell: ({ row }) => {
        const canCancel = isReservationCancelable(row.original);
        const canCheckIn = canCancel;
        const canCheckOut = row.original.status === "checked_in";

        return (
          <div className="flex justify-end gap-2">
            <Button asChild size="sm" type="button" variant="secondary">
              <Link href={`/${hotelId}/reservations/${row.original.id}`} prefetch={false}>
                <Eye />
                Detail
              </Link>
            </Button>
            <Can I="edit" a="Reservation">
              {canCheckIn ? (
                <Button
                  disabled={checkIn.isPending}
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
              ) : null}
              {canCheckOut ? (
                <Button
                  disabled={checkOut.isPending}
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
              ) : null}
              {canCancel ? (
                <Button size="sm" type="button" variant="danger" onClick={() => setReservationToCancel(row.original)}>
                  <Ban />
                  Cancel
                </Button>
              ) : null}
            </Can>
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: rows,
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
    <div className="grid gap-4">
      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_10rem_10rem]">
          <label className="relative block">
            <span className="sr-only">Search reservations</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search by reservation, guest, room, or source"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label>
            <span className="sr-only">Reservation status</span>
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="booked">Booked</option>
              <option value="checked_in">Checked in</option>
              <option value="checked_out">Checked out</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </label>
          <label>
            <span className="sr-only">From date</span>
            <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </label>
          <label>
            <span className="sr-only">To date</span>
            <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </label>
        </div>
      </section>

      {!rows.length ? (
        <DataState empty emptyTitle="No reservations match these filters." />
      ) : (
        <div className="grid gap-3">
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-sm">
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
          <CursorPaginationControls
            hasNextPage={reservations.hasNextPage}
            isFetchingNextPage={reservations.isFetchingNextPage}
            loadedPages={loadedPageCount}
            page={page}
            pageSize={PAGE_SIZE}
            totalItems={reservations.totalItems}
            onNext={handleNextPage}
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          />
        </div>
      )}

      <CancelReservationDialog
        isPending={cancelReservation.isPending}
        open={Boolean(reservationToCancel)}
        reservation={reservationToCancel}
        onConfirm={async (reason) => {
          if (!reservationToCancel) {
            return;
          }
          try {
            await cancelReservation.mutateAsync({
              reservationId: reservationToCancel.id,
              reason,
            });
            toast.success("Reservation cancelled");
            setReservationToCancel(null);
          } catch (error) {
            toast.error(apiErrorMessage(error));
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setReservationToCancel(null);
          }
        }}
      />
    </div>
  );
}

function isReservationCancelable(reservation: Reservation) {
  return ["booked", "confirmed"].includes(reservation.status.toLowerCase());
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
