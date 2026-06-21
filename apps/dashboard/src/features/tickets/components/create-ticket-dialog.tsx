"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage } from "@/lib/api/client";
import { useDepartments } from "@/features/departments/hooks/useDepartments";
import { useRooms } from "@/features/rooms/hooks/useRooms";
import { createTicketSchema, type CreateTicketValues } from "@/features/tickets/schemas/create-ticket.schema";
import { useCreateTicket } from "@/features/tickets/hooks/useTickets";
import { useTicketCategories } from "@/features/workflow/hooks/useWorkflowSettings";

export function CreateTicketDialog({ hotelId }: { hotelId: string }) {
  const [open, setOpen] = useState(false);
  const rooms = useRooms(hotelId);
  const departments = useDepartments(hotelId);
  const categories = useTicketCategories(hotelId);
  const createTicket = useCreateTicket(hotelId);
  const form = useForm<CreateTicketValues>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      department_key: "housekeeping",
      type: "Ticket",
      source: "DASHBOARD",
      priority: 2,
      item_description: "",
      room_id: "",
      task_category_id: "",
      task_category: "",
    },
  });
  const departmentKey = form.watch("department_key");
  const selectedDepartment = departments.data?.find((department) => department.key === departmentKey);
  const categoryOptions = useMemo(
    () =>
      (categories.data ?? []).filter(
        (category) => !selectedDepartment?.id || category.department_id === selectedDepartment.id,
      ),
    [categories.data, selectedDepartment?.id],
  );
  const categoryId = form.watch("task_category_id");

  useEffect(() => {
    if (!categoryOptions.length) {
      return;
    }
    if (!categoryId || !categoryOptions.some((category) => category.id === categoryId)) {
      const first = categoryOptions[0];
      form.setValue("task_category_id", first.id);
      form.setValue("task_category", first.key);
    }
  }, [categoryId, categoryOptions, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const selectedCategory = categories.data?.find((category) => category.id === values.task_category_id);
      const resolvedDepartmentKey = departments.data?.find(
        (department) => department.id === selectedCategory?.department_id,
      )?.key as CreateTicketValues["department_key"] | undefined;
      await createTicket.mutateAsync({
        ...values,
        department_key: resolvedDepartmentKey ?? values.department_key,
        guest_id: values.guest_id || undefined,
        reservation_id: values.reservation_id || undefined,
        conversation_id: values.conversation_id || undefined,
        room_id: values.room_id || undefined,
        task_category_id: selectedCategory?.id,
        task_category: selectedCategory?.key ?? values.task_category ?? undefined,
        source: values.source || "DASHBOARD",
      });
      toast.success("Ticket created");
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
          New ticket
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Ticket</DialogTitle>
          <DialogDescription>Capture a guest or operations request and route it to the right team.</DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="item_description">Description</Label>
            <Textarea id="item_description" {...form.register("item_description")} />
            {form.formState.errors.item_description ? (
              <p className="text-xs text-rose-700">{form.formState.errors.item_description.message}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="department_key">Department</Label>
              <Select id="department_key" {...form.register("department_key")}>
                <option value="front_office">Front office</option>
                <option value="housekeeping">Housekeeping</option>
                <option value="engineering">Engineering</option>
                <option value="food_beverage">Food and beverage</option>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Type</Label>
              <Select id="type" {...form.register("type")}>
                <option value="Ticket">Ticket</option>
                <option value="Complaint">Complaint</option>
                <option value="Food Order">Food order</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="room_id">Room</Label>
              <Select id="room_id" {...form.register("room_id")}>
                <option value="">No room</option>
                {(rooms.data ?? []).map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.room_number}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="priority">Priority</Label>
              <Select id="priority" {...form.register("priority", { valueAsNumber: true })}>
                <option value="1">1 Low</option>
                <option value="2">2 Normal</option>
                <option value="3">3 Elevated</option>
                <option value="4">4 Urgent</option>
                <option value="5">5 Critical</option>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task_category">Category</Label>
              <Select
                id="task_category"
                {...form.register("task_category_id", {
                  onChange: (event) => {
                    const selected = categories.data?.find((category) => category.id === event.target.value);
                    form.setValue("task_category", selected?.key ?? "");
                  },
                })}
              >
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={createTicket.isPending} type="submit">
              {createTicket.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
