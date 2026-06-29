"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
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
import { EntitySearchSelect, type EntitySearchOption } from "@/components/ui/entity-search-select";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRooms } from "@/features/rooms/hooks/useRooms";
import { useStaff } from "@/features/staff/hooks/useStaff";
import {
  createHousekeepingSchema,
  type CreateHousekeepingValues,
} from "@/features/housekeeping/schemas/housekeeping.schema";
import { useCreateHousekeeping } from "@/features/housekeeping/hooks/useHousekeeping";

export function CreateHousekeepingDialog({ hotelId }: { hotelId: string }) {
  const [open, setOpen] = useState(false);
  const [roomSearch, setRoomSearch] = useState("");
  const [staffSearch, setStaffSearch] = useState("");
  const [selectedRoomLabel, setSelectedRoomLabel] = useState("");
  const [selectedStaffLabel, setSelectedStaffLabel] = useState("");
  const debouncedRoomSearch = useDebouncedValue(roomSearch.trim(), 250);
  const debouncedStaffSearch = useDebouncedValue(staffSearch.trim(), 250);
  const rooms = useRooms(hotelId, {
    enabled: open && debouncedRoomSearch.length > 0,
    q: debouncedRoomSearch,
    limit: 8,
  });
  const staff = useStaff(hotelId, {
    enabled: open && debouncedStaffSearch.length > 0,
    q: debouncedStaffSearch,
    limit: 8,
  });
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
      setRoomSearch("");
      setStaffSearch("");
      setSelectedRoomLabel("");
      setSelectedStaffLabel("");
      setOpen(false);
    } catch (error) {
      showApiErrorToast(error);
    }
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setRoomSearch("");
      setStaffSearch("");
    }
  }

  const roomOptions: EntitySearchOption[] = (rooms.data ?? []).map((room) => ({
    value: room.id,
    label: `Room ${room.room_number}`,
    description: [room.room_type, room.floor ? `Floor ${room.floor}` : null, room.status].filter(Boolean).join(" - "),
  }));
  const staffOptions: EntitySearchOption[] = (staff.data ?? []).map((user) => ({
    value: user.id,
    label: user.name,
    description: [user.job_role, user.email].filter(Boolean).join(" - "),
  }));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
              <EntitySearchSelect
                emptyText="No rooms found"
                id="room_id"
                isLoading={rooms.isFetching}
                options={roomOptions}
                placeholder="Type room number..."
                search={roomSearch}
                selectedLabel={selectedRoomLabel}
                value={form.watch("room_id")}
                onSearchChange={setRoomSearch}
                onValueChange={(value, option) => {
                  form.setValue("room_id", value, { shouldValidate: true });
                  setSelectedRoomLabel(option?.label ?? "");
                }}
              />
              {form.formState.errors.room_id ? (
                <p className="text-xs text-rose-700">{form.formState.errors.room_id.message}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="assigned_to">Assign to</Label>
              <EntitySearchSelect
                emptyText="No staff found"
                id="assigned_to"
                isLoading={staff.isFetching}
                options={staffOptions}
                placeholder="Type staff name..."
                search={staffSearch}
                selectedLabel={selectedStaffLabel}
                value={form.watch("assigned_to") ?? ""}
                onSearchChange={setStaffSearch}
                onValueChange={(value, option) => {
                  form.setValue("assigned_to", value, { shouldValidate: true });
                  setSelectedStaffLabel(option?.label ?? "");
                }}
              />
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

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}
