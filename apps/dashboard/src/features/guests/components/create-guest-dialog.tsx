"use client";

import { useState } from "react";
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
import { apiErrorMessage } from "@/lib/api/client";
import {
  createGuestSchema,
  type CreateGuestValues,
} from "@/features/guests/schemas/create-guest.schema";
import { useCreateGuest } from "@/features/guests/hooks/useGuests";

export function CreateGuestDialog({ hotelId }: { hotelId: string }) {
  const [open, setOpen] = useState(false);
  const createGuest = useCreateGuest(hotelId);
  const form = useForm<CreateGuestValues>({
    resolver: zodResolver(createGuestSchema),
    defaultValues: {
      name: "",
      phone: "",
      whatsapp_phone: "",
      email: "",
      check_in_date: "",
      check_out_date: "",
      status: "checked_in",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createGuest.mutateAsync({
        ...values,
        phone: values.phone || undefined,
        whatsapp_phone: values.whatsapp_phone || undefined,
        email: values.email || undefined,
        check_in_date: values.check_in_date || undefined,
        check_out_date: values.check_out_date || undefined,
      });
      toast.success("Guest created");
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
          New guest
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Guest</DialogTitle>
          <DialogDescription>Add a guest profile for reservations and communications.</DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="guest_name">Name</Label>
              <Input id="guest_name" {...form.register("name")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="guest_status">Status</Label>
              <Select id="guest_status" {...form.register("status")}>
                <option value="checked_in">Checked in</option>
                <option value="reserved">Reserved</option>
                <option value="checked_out">Checked out</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="guest_phone">Phone</Label>
              <Input id="guest_phone" {...form.register("phone")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="guest_whatsapp">WhatsApp</Label>
              <Input id="guest_whatsapp" {...form.register("whatsapp_phone")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="guest_email">Email</Label>
              <Input id="guest_email" type="email" {...form.register("email")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="guest_check_in">Check-in</Label>
              <Input id="guest_check_in" type="date" {...form.register("check_in_date")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="guest_check_out">Check-out</Label>
              <Input id="guest_check_out" type="date" {...form.register("check_out_date")} />
            </div>
          </div>

          {form.formState.errors.check_out_date ? (
            <p className="text-xs text-rose-700">{form.formState.errors.check_out_date.message}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={createGuest.isPending} type="submit">
              {createGuest.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
