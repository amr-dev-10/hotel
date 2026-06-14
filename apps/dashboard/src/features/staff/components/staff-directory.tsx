"use client";

import Link from "next/link";
import { Mail, ShieldCheck, UserRoundCheck, UserRoundX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DataState } from "@/components/ui/data-state";
import { compactId, titleCase } from "@/lib/utils";
import { useStaff } from "@/features/staff/hooks/useStaff";

export function StaffDirectory({ hotelId }: { hotelId: string }) {
  const staff = useStaff(hotelId);

  if (staff.isLoading) {
    return <DataState isLoading />;
  }

  if (staff.error) {
    return <DataState error={staff.error} />;
  }

  if (!staff.data?.length) {
    return <DataState empty emptyTitle="No staff users found." />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {staff.data.map((user) => (
        <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm" key={user.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/${hotelId}/settings/staff/${user.id}`} className="hover:text-[#0F3D91]">
                <h2 className="truncate text-base font-semibold">{user.name}</h2>
              </Link>
              <p className="mt-1 flex items-center gap-2 truncate text-sm text-slate-500">
                <Mail className="size-4" />
                {user.email}
              </p>
            </div>
            <Badge variant={user.is_on_duty ? "green" : "default"}>
              {user.is_on_duty ? "On duty" : "Off duty"}
            </Badge>
          </div>

          <div className="mt-4 grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-3 rounded bg-slate-50 px-3 py-2">
              <span className="text-slate-500">Role</span>
              <span className="font-medium">{user.job_role ?? "Staff"}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded bg-slate-50 px-3 py-2">
              <span className="text-slate-500">Level</span>
              <span className="font-medium">{titleCase(user.staff_level)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded bg-slate-50 px-3 py-2">
              <span className="text-slate-500">Department</span>
              <span className="font-medium">{compactId(user.department_id)}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {user.is_active ? (
              <Badge variant="green">
                <UserRoundCheck className="mr-1 size-3" />
                Active
              </Badge>
            ) : (
              <Badge variant="rose">
                <UserRoundX className="mr-1 size-3" />
                Inactive
              </Badge>
            )}
            {user.is_hotel_owner ? (
              <Badge variant="blue">
                <ShieldCheck className="mr-1 size-3" />
                Owner
              </Badge>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
