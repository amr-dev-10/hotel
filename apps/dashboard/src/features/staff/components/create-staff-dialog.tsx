"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus } from "lucide-react";
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
import { createStaffSchema, type CreateStaffValues } from "@/features/staff/schemas/create-staff.schema";
import { useCreateStaff } from "@/features/staff/hooks/useStaff";

export function CreateStaffDialog({ hotelId }: { hotelId: string }) {
  const [open, setOpen] = useState(false);
  const createStaff = useCreateStaff(hotelId);
  const form = useForm<CreateStaffValues>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      department_id: "",
      reports_to: "",
      staff_level: "attendant",
      job_role: "Attendant",
      is_on_duty: true,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createStaff.mutateAsync({
        ...values,
        department_id: values.department_id || undefined,
        reports_to: values.reports_to || undefined,
        job_role: values.job_role || undefined,
      });
      toast.success("Staff member created");
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
          <UserPlus />
          Add staff
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Staff Member</DialogTitle>
          <DialogDescription>Create an operational user for this hotel. Role assignment remains backend-controlled.</DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...form.register("name")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...form.register("email")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="password">Temporary password</Label>
              <Input id="password" type="password" {...form.register("password")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="staff_level">Level</Label>
              <Select id="staff_level" {...form.register("staff_level")}>
                <option value="attendant">Attendant</option>
                <option value="supervisor">Supervisor</option>
                <option value="manager">Manager</option>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="job_role">Job role</Label>
              <Input id="job_role" {...form.register("job_role")} />
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-md border border-slate-200 p-3 text-sm">
            <input className="size-4 accent-[#0F3D91]" type="checkbox" {...form.register("is_on_duty")} />
            On duty
          </label>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={createStaff.isPending} type="submit">
              {createStaff.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
