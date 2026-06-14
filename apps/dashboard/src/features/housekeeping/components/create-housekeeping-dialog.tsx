"use client";

import { useState } from "react";
import { format } from "date-fns";
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
import { useStaff } from "@/features/staff/hooks/useStaff";
import {
  createHousekeepingSchema,
  type CreateHousekeepingValues,
} from "@/features/housekeeping/schemas/housekeeping.schema";
import { useCreateHousekeeping } from "@/features/housekeeping/hooks/useHousekeeping";

export function CreateHousekeepingDialog({ hotelId }: { hotelId: string }) {
  const [open, setOpen] = useState(false);
  const rooms = useRooms(hotelId);
  const staff = useStaff(hotelId);
  const createTask = useCreateHousekeeping(hotelId);
  const form = useForm<CreateHousekeepingValues>({
    resolver: zodResolver(createHousekeepingSchema),
    defaultValues: {
      room_id: "",
      assigned_to: "",
      task_type: "daily_clean",
      scheduled_date: format(new Date(), "yyyy-MM-dd"),
      scheduled_time: "",
      status: "pending",
      priority: 2,
      notes: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createTask.mutateAsync({
        ...values,
        assigned_to: values.assigned_to || undefined,
        scheduled_time: values.scheduled_time || undefined,
        notes: values.notes || undefined,
      });
      toast.success("Housekeeping task created");
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
          New task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Housekeeping Task</DialogTitle>
          <DialogDescription>Schedule room work and assign it to an on-duty team member.</DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="room_id">Room</Label>
              <Select id="room_id" {...form.register("room_id")}>
                <option value="">Select room</option>
                {(rooms.data ?? []).map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.room_number}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="assigned_to">Assign to</Label>
              <Select id="assigned_to" {...form.register("assigned_to")}>
                <option value="">Unassigned</option>
                {(staff.data ?? []).map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="task_type">Task type</Label>
              <Select id="task_type" {...form.register("task_type")}>
                <option value="daily_clean">Daily clean</option>
                <option value="deep_clean">Deep clean</option>
                <option value="turnover">Turnover</option>
                <option value="inspection">Inspection</option>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="scheduled_date">Date</Label>
              <Input id="scheduled_date" type="date" {...form.register("scheduled_date")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="scheduled_time">Time</Label>
              <Input id="scheduled_time" type="time" {...form.register("scheduled_time")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="priority">Priority</Label>
              <Select id="priority" {...form.register("priority", { valueAsNumber: true })}>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...form.register("notes")} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={createTask.isPending} type="submit">
              {createTask.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
