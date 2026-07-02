"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BedDouble, Layers, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { showApiErrorToast } from "@/lib/api/error-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn, titleCase } from "@/lib/utils";
import type { Room } from "@/types/domain";
import { useRooms, useUpdateRoom } from "@/features/rooms/hooks/useRooms";

export function RoomMatrix({ hotelId }: { hotelId: string }) {
  const rooms = useRooms(hotelId);
  const updateRoom = useUpdateRoom(hotelId);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
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
              <Layers className="size-4 text-[var(--primary)]" />
              <h2 className="text-sm font-semibold">Floor {floor}</h2>
              <Badge>{floorRooms.length}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-8">
              {floorRooms.map((room) => (
                <RoomTile key={room.id} room={room} onEdit={() => setEditingRoom(room)} />
              ))}
            </div>
          </div>
        ))}
      </section>
      <EditRoomDialog
        isPending={updateRoom.isPending}
        room={editingRoom}
        onClose={() => setEditingRoom(null)}
        onSubmit={async (roomId, payload) => {
          try {
            await updateRoom.mutateAsync({ roomId, payload });
            toast.success("Room updated");
            setEditingRoom(null);
          } catch (error) {
            showApiErrorToast(error);
          }
        }}
      />
    </div>
  );
}

function RoomTile({ onEdit, room }: { onEdit: () => void; room: Room }) {
  return (
    <div className={cn("rounded-md border p-3", roomStatusClass(room.status))}>
      <div className="flex items-center justify-between gap-2">
        <BedDouble className="size-4" />
        <Badge variant={roomStatusVariant(room.status)}>{titleCase(room.status)}</Badge>
      </div>
      <p className="mt-3 text-lg font-semibold">{room.room_number}</p>
      <p className="truncate text-xs opacity-80">{room.room_type ?? "Standard"}</p>
      {room.notes ? <p className="mt-2 line-clamp-2 text-xs opacity-80">{room.notes}</p> : null}
      <Button className="mt-3 w-full" size="sm" type="button" variant="secondary" onClick={onEdit}>
        <Pencil />
        Edit
      </Button>
    </div>
  );
}

function EditRoomDialog({
  isPending,
  room,
  onClose,
  onSubmit,
}: {
  isPending: boolean;
  room: Room | null;
  onClose: () => void;
  onSubmit: (
    roomId: string,
    payload: {
      room_number: string;
      room_type: string | null;
      floor: string | null;
      status: string;
      notes: string | null;
    },
  ) => Promise<void>;
}) {
  const [roomNumber, setRoomNumber] = useState("");
  const [roomType, setRoomType] = useState("");
  const [floor, setFloor] = useState("");
  const [status, setStatus] = useState("available");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!room) {
      return;
    }
    setRoomNumber(room.room_number);
    setRoomType(room.room_type ?? "");
    setFloor(room.floor ?? "");
    setStatus(room.status);
    setNotes(room.notes ?? "");
  }, [room]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room) {
      return;
    }
    await onSubmit(room.id, {
      room_number: roomNumber,
      room_type: roomType.trim() || null,
      floor: floor.trim() || null,
      status,
      notes: notes.trim() || null,
    });
  }

  return (
    <Dialog open={Boolean(room)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit room</DialogTitle>
          <DialogDescription>Update the room inventory details shown across operations.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={save}>
          <div className="grid gap-4 sm:grid-cols-3">
            <RoomField label="Room number">
              <Input required value={roomNumber} onChange={(event) => setRoomNumber(event.target.value)} />
            </RoomField>
            <RoomField label="Room type">
              <Input value={roomType} onChange={(event) => setRoomType(event.target.value)} />
            </RoomField>
            <RoomField label="Floor">
              <Input value={floor} onChange={(event) => setFloor(event.target.value)} />
            </RoomField>
          </div>
          <RoomField label="Status">
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="dirty">Dirty</option>
              <option value="maintenance">Maintenance</option>
              <option value="blocked">Blocked</option>
            </Select>
          </RoomField>
          <RoomField label="Notes">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </RoomField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={isPending || !roomNumber.trim()} type="submit">
              {isPending ? <Loader2 className="animate-spin" /> : <Pencil />}
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RoomField({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

function groupByFloor(rooms: Room[]) {
  const grouped = new Map<string, Room[]>();
  for (const room of rooms) {
    const floor = room.floor || "Unassigned";
    const floorRooms = grouped.get(floor);
    if (floorRooms) {
      floorRooms.push(room);
    } else {
      grouped.set(floor, [room]);
    }
  }

  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
}

function roomStatusClass(status: string) {
  switch (status) {
    case "available":
      return "border-emerald-100 bg-emerald-50 text-emerald-900";
    case "occupied":
      return "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]";
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
