"use client";

import { useMemo } from "react";
import type { ComponentType } from "react";
import { CheckCircle2, Clock3, LogIn, LogOut, UserCheck, X } from "lucide-react";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { DataState } from "@/components/ui/data-state";
import { titleCase } from "@/lib/utils";
import { useShifts, useStaff } from "@/features/staff/hooks/useStaff";
import type { EmployeeShift } from "@/types/domain";

export function StaffAttendancePage({ hotelId }: { hotelId: string }) {
  const staff = useStaff(hotelId);
  const shifts = useShifts(hotelId);
  const staffById = useMemo(() => new Map((staff.data ?? []).map((user) => [user.id, user])), [staff.data]);
  const today = new Date().toISOString().slice(0, 10);
  const todayShifts = useMemo(
    () => (shifts.data ?? []).filter((shift) => shift.shift_date === today),
    [shifts.data, today],
  );
  const metrics = useMemo(() => {
    const presentUserIds = new Set(
      todayShifts
        .filter((shift) => ["checked_in", "completed"].includes(shift.status))
        .map((shift) => shift.user_id),
    );
    (staff.data ?? []).forEach((user) => {
      if (user.is_on_duty) {
        presentUserIds.add(user.id);
      }
    });

    return {
      present: presentUserIds.size,
      absent: todayShifts.filter((shift) => shift.status === "absent").length,
      late: todayShifts.filter((shift) => shift.status === "late").length,
      onLeave: todayShifts.filter((shift) => shift.status === "on_leave").length,
      checkedIn: todayShifts.filter((shift) => Boolean(shift.actual_start) || shift.status === "checked_in").length,
      checkedOut: todayShifts.filter((shift) => Boolean(shift.actual_end) || shift.status === "completed").length,
    };
  }, [staff.data, todayShifts]);

  if (staff.isLoading || shifts.isLoading) {
    return <DataState isLoading />;
  }

  if (staff.error || shifts.error) {
    return <DataState error={staff.error ?? shifts.error} />;
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
        <Metric icon={UserCheck} label="Present today" value={metrics.present} />
        <Metric icon={X} label="Absent" value={metrics.absent} />
        <Metric icon={Clock3} label="Late" value={metrics.late} />
        <Metric icon={CheckCircle2} label="On leave" value={metrics.onLeave} />
        <Metric icon={LogIn} label="Checked in" value={metrics.checkedIn} />
        <Metric icon={LogOut} label="Checked out" value={metrics.checkedOut} />
      </div>

      <section className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <div className="grid min-w-[760px] grid-cols-[1fr_150px_150px_130px_140px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
          <span>Employee</span>
          <span>Check in</span>
          <span>Check out</span>
          <span>Hours worked</span>
          <span>Status</span>
        </div>
        {todayShifts.length ? (
          todayShifts.map((shift) => (
            <div
              className="grid min-w-[760px] grid-cols-[1fr_150px_150px_130px_140px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
              key={shift.id}
            >
              <span className="truncate font-medium">{staffById.get(shift.user_id)?.name ?? "Unknown staff"}</span>
              <span className="truncate text-slate-600">{timeLabel(shift.actual_start ?? shift.shift_start)}</span>
              <span className="truncate text-slate-600">{timeLabel(shift.actual_end ?? shift.shift_end)}</span>
              <span className="truncate text-slate-600">{shiftHours(shift)}</span>
              <Badge variant={shiftVariant(shift.status)}>{titleCase(shift.status)}</Badge>
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

function numericShiftHours(shift: EmployeeShift) {
  const start = shift.actual_start ? new Date(shift.actual_start) : shiftDateTime(shift.shift_date, shift.shift_start);
  const end = shift.actual_end ? new Date(shift.actual_end) : shiftDateTime(shift.shift_date, shift.shift_end);
  return Math.max(0, end.getTime() - start.getTime()) / 3600000;
}

function shiftHours(shift: EmployeeShift) {
  return `${numericShiftHours(shift).toFixed(1)}h`;
}

function shiftDateTime(date: string, time: string) {
  return new Date(`${date}T${time}`);
}

function timeLabel(value: string) {
  const normalized = value.includes("T") ? value : `2026-01-01T${value}`;
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date(normalized));
}

function shiftVariant(status: string): "green" | "amber" | "blue" | "rose" | "default" {
  if (["completed", "checked_in"].includes(status)) {
    return "green";
  }
  if (status === "late") {
    return "amber";
  }
  if (status === "scheduled") {
    return "blue";
  }
  if (["absent", "on_leave"].includes(status)) {
    return "rose";
  }
  return "default";
}
