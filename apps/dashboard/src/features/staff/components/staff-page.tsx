"use client";

import Link from "next/link";
import { Building2, CalendarClock, ClipboardCheck, Network, Shield, TicketCheck, UserPlus } from "lucide-react";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { Button } from "@/components/ui/button";
import { CreateStaffDialog } from "@/features/staff/components/create-staff-dialog";
import { StaffDirectory } from "@/features/staff/components/staff-directory";
import { Can } from "@/lib/auth/can";

export function StaffPage({ hotelId }: { hotelId: string }) {
  const modules = [
    { label: "Hierarchy", href: `/${hotelId}/settings/staff/hierarchy`, icon: Network },
    { label: "Shifts", href: `/${hotelId}/settings/staff/shifts`, icon: CalendarClock },
    { label: "Attendance", href: `/${hotelId}/settings/staff/attendance`, icon: ClipboardCheck },
    { label: "Departments", href: `/${hotelId}/settings/staff/departments`, icon: Building2 },
    { label: "Workload", href: `/${hotelId}/settings/staff/workload`, icon: TicketCheck },
    { label: "Roles", href: `/${hotelId}/settings/staff/roles`, icon: Shield },
  ];

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <PageBreadcrumbs
          current="Staff Management"
          description="Directory, workforce structure, roster signals, and access control."
          hotelId={hotelId}
          items={[{ label: "Settings" }]}
        />
        <div className="flex gap-2">
          <Can I="create" a="Staff">
            <Button asChild type="button" variant="secondary">
              <Link href={`/${hotelId}/settings/staff/new`}>
                <UserPlus />
                Open form
              </Link>
            </Button>
            <CreateStaffDialog hotelId={hotelId} />
          </Can>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Link
              className="flex h-16 items-center gap-3 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold shadow-sm transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
              href={module.href}
              key={module.href}
            >
              <Icon className="size-4 text-slate-500" />
              {module.label}
            </Link>
          );
        })}
      </div>
      <StaffDirectory hotelId={hotelId} />
    </div>
  );
}
