"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { showApiErrorToast } from "@/lib/api/error-toast";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createRoomSchema, type CreateRoomValues } from "@/features/rooms/schemas/create-room.schema";
import { useCreateRoom } from "@/features/rooms/hooks/useRooms";

export function CreateRoomDialog({ hotelId }: { hotelId: string }) {
  const [open, setOpen] = useState(false);
  const createRoom = useCreateRoom(hotelId);
  const form = useForm<CreateRoomValues>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      room_number: "",
      room_type: "",
      floor: "",
      status: "available",
      notes: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createRoom.mutateAsync({
        ...values,
        room_type: values.room_type || undefined,
        floor: values.floor || undefined,
        notes: values.notes || undefined,
      });
      toast.success("Room created");
      form.reset();
      setOpen(false);
    } catch (error) {
      showApiErrorToast(error);
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <Plus />
          New room
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Room</DialogTitle>
          <DialogDescription>Add a physical room to the hotel inventory.</DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="room_number">Room number</Label>
              <Input id="room_number" {...form.register("room_number")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="room_type">Room type</Label>
              <Input id="room_type" placeholder="Deluxe" {...form.register("room_type")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="floor">Floor</Label>
              <Input id="floor" placeholder="2" {...form.register("floor")} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select id="status" {...form.register("status")}>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="dirty">Dirty</option>
              <option value="maintenance">Maintenance</option>
              <option value="blocked">Blocked</option>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...form.register("notes")} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={createRoom.isPending} type="submit">
              {createRoom.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
