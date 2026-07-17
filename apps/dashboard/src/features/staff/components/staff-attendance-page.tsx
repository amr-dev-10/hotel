"use client";

import type { ComponentType } from "react";
import { CheckCircle2, Clock3, LogIn, LogOut, UserCheck, X } from "lucide-react";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { DataState } from "@/components/ui/data-state";
import { titleCase } from "@/lib/utils";
import { useAttendanceDashboard } from "@/features/staff/hooks/useAttendance";
import type { AttendanceLog } from "@/types/domain";

export function StaffAttendancePage({ hotelId }: { hotelId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const dashboard = useAttendanceDashboard(hotelId, today);
  const metrics = dashboard.data;
  const logs = metrics?.logs ?? [];

  if (dashboard.isLoading) {
    return <DataState isLoading />;
  }

  if (dashboard.error) {
    return <DataState error={dashboard.error} />;
  }

  return (
    <div className="grid gap-5">
      <PageBreadcrumbs
        current="Attendance"
        description="Daily staff presence and worked-hour status."
        hotelId={hotelId}
        items={[
          { label: "Settings" },
          { label: "Staff Management", href: `/${hotelId}/settings/staff` },
        ]}
      />

      <div className="grid gap-3 md:grid-cols-6">
        <Metric icon={UserCheck} label="Present today" value={metrics?.present ?? 0} />
        <Metric icon={X} label="Absent" value={metrics?.absent ?? 0} />
        <Metric icon={Clock3} label="Late" value={metrics?.late ?? 0} />
        <Metric icon={CheckCircle2} label="On leave" value={metrics?.on_leave ?? 0} />
        <Metric icon={LogIn} label="Checked in" value={metrics?.checked_in ?? 0} />
        <Metric icon={LogOut} label="Checked out" value={metrics?.checked_out ?? 0} />
      </div>

      <section className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <div className="grid min-w-[760px] grid-cols-[1fr_150px_150px_130px_140px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
          <span>Employee</span>
          <span>Check in</span>
          <span>Check out</span>
          <span>Hours worked</span>
          <span>Status</span>
        </div>
        {logs.length ? (
          logs.map((log) => (
            <div
              className="grid min-w-[760px] grid-cols-[1fr_150px_150px_130px_140px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
              key={log.id}
            >
              <span className="truncate font-medium">{log.employee_name ?? log.employee_code ?? "Unknown staff"}</span>
              <span className="truncate text-slate-600">{timeLabel(log.actual_start)}</span>
              <span className="truncate text-slate-600">{timeLabel(log.actual_end)}</span>
              <span className="truncate text-slate-600">{workedHours(log)}</span>
              <Badge variant={attendanceVariant(log)}>{titleCase(log.attendance_status)}</Badge>
            </div>
          ))
        ) : (
          <DataState empty emptyTitle="No attendance records for today." />
        )}
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
        <Icon className="size-4 text-slate-500" />
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function workedHours(log: AttendanceLog) {
  return `${(log.worked_minutes / 60).toFixed(1)}h`;
}

function timeLabel(value: string | null) {
  if (!value) {
    return "Pending";
  }
  const normalized = value.includes("T") ? value : `2026-01-01T${value}`;
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date(normalized));
}

function attendanceVariant(log: AttendanceLog): "green" | "amber" | "blue" | "rose" | "default" {
  const status = log.attendance_status.toLowerCase();
  if (["completed", "checked_in"].includes(status)) {
    return "green";
  }
  if (log.arrival_status.toLowerCase() === "late") {
    return "amber";
  }
  if (status === "scheduled") {
    return "blue";
  }
  if (["absent", "holiday", "weekend"].includes(status)) {
    return "rose";
  }
  return "default";
}
