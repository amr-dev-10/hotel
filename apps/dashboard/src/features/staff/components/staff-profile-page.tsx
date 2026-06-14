"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { apiErrorMessage } from "@/lib/api/client";
import { compactId, titleCase } from "@/lib/utils";
import { useDepartments } from "@/features/departments/hooks/useDepartments";
import { useAssignUserRoles, useRoles } from "@/features/roles/hooks/useRoles";
import { useStaff } from "@/features/staff/hooks/useStaff";

export function StaffProfilePage({
  hotelId,
  staffId,
}: {
  hotelId: string;
  staffId: string;
}) {
  const staff = useStaff(hotelId);
  const roles = useRoles(hotelId);
  const departments = useDepartments(hotelId);
  const assignRoles = useAssignUserRoles(hotelId, staffId);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const user = useMemo(() => staff.data?.find((item) => item.id === staffId), [staff.data, staffId]);
  const department = departments.data?.find((item) => item.id === user?.department_id);

  async function handleAssignRoles() {
    try {
      await assignRoles.mutateAsync(selectedRoles);
      toast.success("Role assignment saved");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  if (staff.isLoading || roles.isLoading || departments.isLoading) {
    return <DataState isLoading />;
  }

  if (staff.error || roles.error || departments.error) {
    return <DataState error={staff.error ?? roles.error ?? departments.error} />;
  }

  if (!user) {
    return <DataState empty emptyTitle="Staff member not found." />;
  }

  function toggleRole(roleId: string) {
    setSelectedRoles((current) =>
      current.includes(roleId) ? current.filter((item) => item !== roleId) : [...current, roleId],
    );
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Button asChild type="button" variant="ghost">
            <Link href={`/${hotelId}/settings/staff`}>
              <ArrowLeft />
              Staff
            </Link>
          </Button>
          <h2 className="mt-2 text-xl font-semibold">{user.name}</h2>
          <p className="text-sm text-slate-500">{user.email}</p>
        </div>
        <Badge variant={user.is_active ? "green" : "rose"}>{user.is_active ? "Active" : "Inactive"}</Badge>
      </div>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-3">
        <Detail label="Job role" value={user.job_role ?? "Staff"} />
        <Detail label="Staff level" value={titleCase(user.staff_level)} />
        <Detail label="Department" value={department?.name ?? compactId(user.department_id)} />
        <Detail label="Reports to" value={compactId(user.reports_to)} />
        <Detail label="Duty status" value={user.is_on_duty ? "On duty" : "Off duty"} />
        <Detail label="Owner" value={user.is_hotel_owner ? "Yes" : "No"} />
      </section>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-semibold">Role Assignment</h3>
            <p className="text-sm text-slate-500">Assign one or more backend roles to this staff account.</p>
          </div>
          <Button disabled={assignRoles.isPending} type="button" onClick={handleAssignRoles}>
            {assignRoles.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            Save roles
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(roles.data ?? []).map((role) => (
            <label
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm"
              key={role.id}
            >
              <input
                checked={selectedRoles.includes(role.id)}
                className="size-4 accent-[#0F3D91]"
                type="checkbox"
                onChange={() => toggleRole(role.id)}
              />
              <ShieldCheck className="size-4 text-slate-500" />
              {role.name}
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}
