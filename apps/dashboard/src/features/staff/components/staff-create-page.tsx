"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Sparkles, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { showApiErrorToast } from "@/lib/api/error-toast";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Select } from "@/components/ui/select";
import { useDepartments } from "@/features/departments/hooks/useDepartments";
import { createStaffSchema, type CreateStaffValues } from "@/features/staff/schemas/create-staff.schema";
import { useCreateStaff, useGenerateEmployeeCode, useStaff } from "@/features/staff/hooks/useStaff";

export function StaffCreatePage({ hotelId }: { hotelId: string }) {
  const router = useRouter();
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
      router.push(`/${hotelId}/settings/staff`);
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
    <form className="grid gap-5" onSubmit={onSubmit}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <PageBreadcrumbs
          current="New Staff Member"
          hotelId={hotelId}
          items={[
            { label: "Settings" },
            { label: "Staff Management", href: `/${hotelId}/settings/staff` },
          ]}
        />
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
            <PasswordInput id="staff-password" {...form.register("password")} />
          </Field>
          <Field label="Employee code" id="staff-employee-code">
            <div className="flex gap-2">
              <Input
                className="font-mono uppercase"
                id="staff-employee-code"
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
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="supervisor">Supervisor</option>
              <option value="attendant">Attendant</option>
            </Select>
          </Field>
          <label className="flex items-center gap-2 rounded-md border border-slate-200 p-3 text-sm">
            <input className="size-4 accent-[var(--primary)]" type="checkbox" {...form.register("is_on_duty")} />
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
