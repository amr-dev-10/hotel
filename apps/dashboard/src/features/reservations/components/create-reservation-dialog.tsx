"use client";

import { useState } from "react";
import { addDays, format } from "date-fns";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

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
import { apiErrorMessage } from "@/lib/api/client";
import { useRooms } from "@/features/rooms/hooks/useRooms";
import {
  createReservationSchema,
  type CreateReservationValues,
} from "@/features/reservations/schemas/create-reservation.schema";
import { useCreateReservation } from "@/features/reservations/hooks/useReservations";

export function CreateReservationDialog({ hotelId }: { hotelId: string }) {
  const [open, setOpen] = useState(false);
  const rooms = useRooms(hotelId);
  const createReservation = useCreateReservation(hotelId);
  const form = useForm<CreateReservationValues>({
    resolver: zodResolver(createReservationSchema),
    defaultValues: {
      guest_name: "",
      phone: "",
      whatsapp_phone: "",
      room_id: "",
      room_type_id: "",
      checkin_date: format(new Date(), "yyyy-MM-dd"),
      checkout_date: format(addDays(new Date(), 1), "yyyy-MM-dd"),
      source: "walk_in",
      notes: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createReservation.mutateAsync({
        ...values,
        phone: values.phone || undefined,
        whatsapp_phone: values.whatsapp_phone || undefined,
        room_id: values.room_id || undefined,
        room_type_id: values.room_type_id || undefined,
        notes: values.notes || undefined,
      });
      toast.success("Reservation created");
      form.reset();
      setOpen(false);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <Plus />
          New reservation
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Reservation</DialogTitle>
          <DialogDescription>Add a walk-in or direct booking without changing backend reservation logic.</DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="guest_name">Guest name</Label>
              <Input id="guest_name" {...form.register("guest_name")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...form.register("phone")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="checkin_date">Check-in</Label>
              <Input id="checkin_date" type="date" {...form.register("checkin_date")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="checkout_date">Check-out</Label>
              <Input id="checkout_date" type="date" {...form.register("checkout_date")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="source">Source</Label>
              <Select id="source" {...form.register("source")}>
                <option value="walk_in">Walk-in</option>
                <option value="direct">Direct</option>
                <option value="ota">OTA</option>
                <option value="corporate">Corporate</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="room_id">Room</Label>
              <Select id="room_id" {...form.register("room_id")}>
                <option value="">Assign later</option>
                {(rooms.data ?? []).map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.room_number} {room.room_type ? `- ${room.room_type}` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="whatsapp_phone">WhatsApp</Label>
              <Input id="whatsapp_phone" {...form.register("whatsapp_phone")} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...form.register("notes")} />
          </div>

          {form.formState.errors.checkout_date ? (
            <p className="text-xs text-rose-700">{form.formState.errors.checkout_date.message}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={createReservation.isPending} type="submit">
              {createReservation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
