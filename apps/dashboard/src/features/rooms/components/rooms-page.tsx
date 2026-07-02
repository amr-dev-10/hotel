"use client";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { CreateRoomDialog } from "@/features/rooms/components/create-room-dialog";
import { RoomMatrix } from "@/features/rooms/components/room-matrix";

export function RoomsPage({ hotelId }: { hotelId: string }) {
  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <PageBreadcrumbs
          current="Rooms"
          description="Track room inventory, occupancy, and operational holds."
          hotelId={hotelId}
        />
        <CreateRoomDialog hotelId={hotelId} />
      </div>
      <RoomMatrix hotelId={hotelId} />
    </div>
  );
}
