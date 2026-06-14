"use client";

import { useMemo } from "react";
import { BedDouble, Layers } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DataState } from "@/components/ui/data-state";
import { cn, titleCase } from "@/lib/utils";
import type { Room } from "@/types/domain";
import { useRooms } from "@/features/rooms/hooks/useRooms";

export function RoomMatrix({ hotelId }: { hotelId: string }) {
  const rooms = useRooms(hotelId);
  const floors = useMemo(() => groupByFloor(rooms.data ?? []), [rooms.data]);

  if (rooms.isLoading) {
    return <DataState isLoading />;
  }

  if (rooms.error) {
    return <DataState error={rooms.error} />;
  }

  if (!rooms.data?.length) {
    return <DataState empty emptyTitle="No rooms have been created yet." />;
  }

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {["available", "occupied", "dirty", "maintenance", "blocked"].map((status) => (
          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm" key={status}>
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{titleCase(status)}</p>
            <p className="mt-2 text-2xl font-semibold">
              {rooms.data.filter((room) => room.status === status).length}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-4">
        {floors.map(([floor, floorRooms]) => (
          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm" key={floor}>
            <div className="mb-3 flex items-center gap-2">
              <Layers className="size-4 text-[#0F3D91]" />
              <h2 className="text-sm font-semibold">Floor {floor}</h2>
              <Badge>{floorRooms.length}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-8">
              {floorRooms.map((room) => (
                <RoomTile key={room.id} room={room} />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function RoomTile({ room }: { room: Room }) {
  return (
    <div className={cn("rounded-md border p-3", roomStatusClass(room.status))}>
      <div className="flex items-center justify-between gap-2">
        <BedDouble className="size-4" />
        <Badge variant={roomStatusVariant(room.status)}>{titleCase(room.status)}</Badge>
      </div>
      <p className="mt-3 text-lg font-semibold">{room.room_number}</p>
      <p className="truncate text-xs opacity-80">{room.room_type ?? "Standard"}</p>
      {room.notes ? <p className="mt-2 line-clamp-2 text-xs opacity-80">{room.notes}</p> : null}
    </div>
  );
}

function groupByFloor(rooms: Room[]) {
  const grouped = new Map<string, Room[]>();
  for (const room of rooms) {
    const floor = room.floor || "Unassigned";
    grouped.set(floor, [...(grouped.get(floor) ?? []), room]);
  }

  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
}

function roomStatusClass(status: string) {
  switch (status) {
    case "available":
      return "border-emerald-100 bg-emerald-50 text-emerald-900";
    case "occupied":
      return "border-[#0F3D91]/20 bg-[#0F3D91]/10 text-[#0F3D91]";
    case "dirty":
      return "border-amber-100 bg-amber-50 text-amber-900";
    case "maintenance":
      return "border-rose-100 bg-rose-50 text-rose-900";
    case "blocked":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-slate-200 bg-white text-slate-900";
  }
}

function roomStatusVariant(status: string) {
  switch (status) {
    case "available":
      return "green";
    case "occupied":
      return "blue";
    case "dirty":
      return "amber";
    case "maintenance":
      return "rose";
    default:
      return "default";
  }
}
