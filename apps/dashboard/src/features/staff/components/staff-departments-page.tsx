"use client";

import { Building2 } from "lucide-react";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { DataState } from "@/components/ui/data-state";
import { titleCase } from "@/lib/utils";
import { useDepartments } from "@/features/departments/hooks/useDepartments";

export function StaffDepartmentsPage({ hotelId }: { hotelId: string }) {
  const departments = useDepartments(hotelId);

  if (departments.isLoading) {
    return <DataState isLoading />;
  }

  if (departments.error) {
    return <DataState error={departments.error} />;
  }

  return (
    <div className="grid gap-5">
      <PageBreadcrumbs
        current="Departments"
        description="Operational teams used for staff routing and ticket ownership."
        hotelId={hotelId}
        items={[
          { label: "Settings" },
          { label: "Staff Management", href: `/${hotelId}/settings/staff` },
        ]}
      />

      <section className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <div className="grid min-w-[760px] grid-cols-[1fr_160px_140px_160px_140px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
          <span>Department</span>
          <span>Key</span>
          <span>Status</span>
          <span>Resolution time</span>
          <span>Sort order</span>
        </div>
        {departments.data?.length ? (
          departments.data.map((department) => (
            <div
              className="grid min-w-[760px] grid-cols-[1fr_160px_140px_160px_140px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
              key={department.id}
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{department.name}</p>
                <p className="truncate text-xs text-slate-500">{department.description ?? "No description"}</p>
              </div>
              <span className="flex items-center gap-2 truncate text-slate-600">
                <Building2 className="size-4" />
                {department.key}
              </span>
              <Badge variant={department.is_active ? "green" : "rose"}>
                {department.is_active ? "Active" : "Inactive"}
              </Badge>
              <span className="truncate text-slate-600">{department.resolution_time ?? "Not set"}</span>
              <span className="truncate text-slate-600">{titleCase(String(department.sort_order))}</span>
            </div>
          ))
        ) : (
          <DataState empty emptyTitle="No departments configured." />
        )}
      </section>
    </div>
  );
}
