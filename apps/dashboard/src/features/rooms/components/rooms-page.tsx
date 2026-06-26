"use client";

import { CreateRoomDialog } from "@/features/rooms/components/create-room-dialog";
import { RoomMatrix } from "@/features/rooms/components/room-matrix";

export function RoomsPage({ hotelId }: { hotelId: string }) {
  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Rooms</h2>
          <p className="text-sm text-slate-500">Track room inventory, occupancy, and operational holds.</p>
        </div>
        <CreateRoomDialog hotelId={hotelId} />
      </div>
      <RoomMatrix hotelId={hotelId} />
    </div>
  );
}
