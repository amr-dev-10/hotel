"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiErrorMessage } from "@/lib/api/client";
import { useDepartments } from "@/features/departments/hooks/useDepartments";
import { createStaffSchema, type CreateStaffValues } from "@/features/staff/schemas/create-staff.schema";
import { useCreateStaff, useStaff } from "@/features/staff/hooks/useStaff";

export function StaffCreatePage({ hotelId }: { hotelId: string }) {
  const router = useRouter();
  const createStaff = useCreateStaff(hotelId);
  const departments = useDepartments(hotelId);
  const staff = useStaff(hotelId);
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
      router.push(`/${hotelId}/settings/staff`);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  });

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Button asChild type="button" variant="ghost">
            <Link href={`/${hotelId}/settings/staff`}>
              <ArrowLeft />
              Staff
            </Link>
          </Button>
          <h2 className="mt-2 text-xl font-semibold">New Staff Member</h2>
        </div>
        <Button disabled={createStaff.isPending} type="submit">
          {createStaff.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}
          Create staff
        </Button>
      </div>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name" id="staff-name">
            <Input id="staff-name" {...form.register("name")} />
          </Field>
          <Field label="Email" id="staff-email">
            <Input id="staff-email" type="email" {...form.register("email")} />
          </Field>
          <Field label="Temporary password" id="staff-password">
            <Input id="staff-password" type="password" {...form.register("password")} />
          </Field>
          <Field label="Job role" id="staff-job-role">
            <Input id="staff-job-role" {...form.register("job_role")} />
          </Field>
          <Field label="Department" id="staff-department">
            <Select id="staff-department" {...form.register("department_id")}>
              <option value="">Unassigned</option>
              {(departments.data ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reports to" id="staff-reports-to">
            <Select id="staff-reports-to" {...form.register("reports_to")}>
              <option value="">None</option>
              {(staff.data ?? []).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Level" id="staff-level">
            <Select id="staff-level" {...form.register("staff_level")}>
              <option value="attendant">Attendant</option>
              <option value="supervisor">Supervisor</option>
              <option value="manager">Manager</option>
            </Select>
          </Field>
          <label className="flex items-center gap-2 rounded-md border border-slate-200 p-3 text-sm">
            <input className="size-4 accent-[#0F3D91]" type="checkbox" {...form.register("is_on_duty")} />
            On duty
          </label>
        </div>
      </section>
    </form>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
