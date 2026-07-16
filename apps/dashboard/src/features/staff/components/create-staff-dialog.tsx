"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Sparkles, UserPlus } from "lucide-react";
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
import { PasswordInput } from "@/components/ui/password-input";
import { Select } from "@/components/ui/select";
import { useDepartments } from "@/features/departments/hooks/useDepartments";
import { createStaffSchema, type CreateStaffValues } from "@/features/staff/schemas/create-staff.schema";
import { useCreateStaff, useGenerateEmployeeCode, useStaff } from "@/features/staff/hooks/useStaff";

export function CreateStaffDialog({ hotelId }: { hotelId: string }) {
  const [open, setOpen] = useState(false);
  const createStaff = useCreateStaff(hotelId);
  const generateEmployeeCode = useGenerateEmployeeCode(hotelId);
  const departments = useDepartments(hotelId);
  const staff = useStaff(hotelId);
  const form = useForm<CreateStaffValues>({
    resolver: zodResolver(createStaffSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      employee_code: "",
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
        employee_code: values.employee_code?.trim() || undefined,
        department_id: values.department_id || undefined,
        reports_to: values.reports_to || undefined,
        job_role: values.job_role || undefined,
      });
      toast.success("Staff member created");
      form.reset();
      setOpen(false);
    } catch (error) {
      showApiErrorToast(error);
    }
  });

  async function handleGenerateEmployeeCode() {
    try {
      const generated = await generateEmployeeCode.mutateAsync({
        staff_level: form.getValues("staff_level"),
      });
      form.setValue("employee_code", generated.employee_code, {
        shouldDirty: true,
        shouldValidate: true,
      });
      toast.success("Employee code generated");
    } catch (error) {
      showApiErrorToast(error);
    }
  }

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

          <div className="grid gap-2">
            <Label htmlFor="employee_code">Employee code</Label>
            <div className="flex gap-2">
              <Input
                className="font-mono uppercase"
                id="employee_code"
                placeholder="TAJMANG234AX"
                {...form.register("employee_code")}
              />
              <Button
                className="shrink-0"
                disabled={generateEmployeeCode.isPending}
                type="button"
                variant="secondary"
                onClick={handleGenerateEmployeeCode}
              >
                {generateEmployeeCode.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                Auto-generate
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="password">Temporary password</Label>
              <PasswordInput id="password" {...form.register("password")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="staff_level">Level</Label>
              <Select id="staff_level" {...form.register("staff_level")}>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="supervisor">Supervisor</option>
                <option value="attendant">Attendant</option>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="job_role">Job role</Label>
              <Input id="job_role" {...form.register("job_role")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="department_id">Department</Label>
              <Select id="department_id" {...form.register("department_id")}>
                <option value="">Unassigned</option>
                {(departments.data ?? []).map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reports_to">Reports to</Label>
              <Select id="reports_to" {...form.register("reports_to")}>
                <option value="">None</option>
                {(staff.data ?? []).map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-md border border-slate-200 p-3 text-sm">
            <input className="size-4 accent-[var(--primary)]" type="checkbox" {...form.register("is_on_duty")} />
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
