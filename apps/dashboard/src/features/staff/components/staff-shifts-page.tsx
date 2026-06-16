"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CalendarClock, Loader2, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiErrorMessage } from "@/lib/api/client";
import { compactId, titleCase } from "@/lib/utils";
import { useDepartments } from "@/features/departments/hooks/useDepartments";
import { shiftSchema, type ShiftValues } from "@/features/staff/schemas/create-staff.schema";
import { useCreateShift, useShifts, useStaff } from "@/features/staff/hooks/useStaff";
import type { EmployeeShift, StaffUser } from "@/types/domain";

export function StaffShiftsPage({ hotelId }: { hotelId: string }) {
  const staff = useStaff(hotelId);
  const departments = useDepartments(hotelId);
  const shifts = useShifts(hotelId);
  const createShift = useCreateShift(hotelId);
  const [viewMode, setViewMode] = useState("weekly");
  const form = useForm<ShiftValues>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      user_id: "",
      department_id: "",
      shift_date: new Date().toISOString().slice(0, 10),
      shift_start: "09:00",
      shift_end: "17:00",
      shift_type: "morning",
      status: "scheduled",
      notes: "",
    },
  });

  const staffById = useMemo(() => new Map((staff.data ?? []).map((user) => [user.id, user])), [staff.data]);
  const departmentById = useMemo(
    () => new Map((departments.data ?? []).map((department) => [department.id, department.name])),
    [departments.data],
  );
  const visibleShifts = useMemo(() => filterShiftsByView(shifts.data ?? [], viewMode), [shifts.data, viewMode]);
  const grouped = useMemo(() => groupByDate(visibleShifts), [visibleShifts]);
  const metrics = useMemo(() => {
    const records = shifts.data ?? [];
    return {
      scheduled: records.filter((shift) => shift.status === "scheduled").length,
      checkedIn: records.filter((shift) => shift.status === "checked_in").length,
      completed: records.filter((shift) => shift.status === "completed").length,
      exceptions: records.filter((shift) => ["absent", "late", "on_leave"].includes(shift.status)).length,
    };
  }, [shifts.data]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createShift.mutateAsync({
        ...values,
        department_id: values.department_id || undefined,
        notes: values.notes || undefined,
      });
      toast.success("Shift created");
      form.reset({
        ...values,
        user_id: "",
        department_id: "",
        notes: "",
      });
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  });

  if (staff.isLoading || departments.isLoading || shifts.isLoading) {
    return <DataState isLoading />;
  }

  if (staff.error || departments.error || shifts.error) {
    return <DataState error={staff.error ?? departments.error ?? shifts.error} />;
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
          <h2 className="mt-2 text-xl font-semibold">Shift Management</h2>
          <p className="text-sm text-slate-500">Calendar and roster planning for hotel teams.</p>
        </div>
        <div className="w-full sm:w-44">
          <Select aria-label="Shift view" value={viewMode} onChange={(event) => setViewMode(event.target.value)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Scheduled" value={metrics.scheduled} />
        <Metric label="Checked in" value={metrics.checkedIn} />
        <Metric label="Completed" value={metrics.completed} />
        <Metric label="Exceptions" value={metrics.exceptions} />
      </div>

      <form className="grid gap-4 rounded-md border border-slate-200 bg-white p-4" onSubmit={onSubmit}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Create Shift</h3>
          <Button disabled={createShift.isPending} type="submit">
            {createShift.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            Save shift
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Employee" id="shift-user">
            <Select id="shift-user" {...form.register("user_id")}>
              <option value="">Select employee</option>
              {(staff.data ?? []).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Department" id="shift-department">
            <Select id="shift-department" {...form.register("department_id")}>
              <option value="">Auto</option>
              {(departments.data ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date" id="shift-date">
            <Input id="shift-date" type="date" {...form.register("shift_date")} />
          </Field>
          <Field label="Shift type" id="shift-type">
            <Select id="shift-type" {...form.register("shift_type")}>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="night">Night</option>
              <option value="custom">Custom</option>
            </Select>
          </Field>
          <Field label="Start time" id="shift-start">
            <Input id="shift-start" type="time" {...form.register("shift_start")} />
          </Field>
          <Field label="End time" id="shift-end">
            <Input id="shift-end" type="time" {...form.register("shift_end")} />
          </Field>
          <Field label="Status" id="shift-status">
            <Select id="shift-status" {...form.register("status")}>
              <option value="scheduled">Scheduled</option>
              <option value="checked_in">Checked in</option>
              <option value="completed">Completed</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
              <option value="on_leave">On leave</option>
            </Select>
          </Field>
          <Field label="Notes" id="shift-notes">
            <Input id="shift-notes" {...form.register("notes")} />
          </Field>
        </div>
      </form>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-slate-500" />
          <h3 className="text-base font-semibold">Calendar View</h3>
        </div>
        {grouped.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {grouped.map(([date, records]) => (
              <div className="rounded-md border border-slate-200 p-3" key={date}>
                <p className="font-semibold">{dateLabel(date)}</p>
                <div className="mt-3 grid gap-2">
                  {records.map((shift) => (
                    <ShiftPill key={shift.id} shift={shift} staffMember={staffById.get(shift.user_id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <DataState empty emptyTitle="No shifts in this view." />
        )}
      </section>

      <section className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <div className="grid min-w-[760px] grid-cols-[1fr_150px_170px_150px_140px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
          <span>Employee</span>
          <span>Department</span>
          <span>Shift</span>
          <span>Date</span>
          <span>Status</span>
        </div>
        {visibleShifts.length ? (
          visibleShifts.map((shift) => (
            <div
              className="grid min-w-[760px] grid-cols-[1fr_150px_170px_150px_140px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
              key={shift.id}
            >
              <span className="truncate font-medium">{staffById.get(shift.user_id)?.name ?? compactId(shift.user_id)}</span>
              <span className="truncate text-slate-600">
                {shift.department_id ? departmentById.get(shift.department_id) ?? compactId(shift.department_id) : "Auto"}
              </span>
              <span className="truncate text-slate-600">
                {timeLabel(shift.shift_start)} - {timeLabel(shift.shift_end)}
              </span>
              <span className="truncate text-slate-600">{dateLabel(shift.shift_date)}</span>
              <Badge variant={shiftVariant(shift.status)}>{titleCase(shift.status)}</Badge>
            </div>
          ))
        ) : (
          <DataState empty emptyTitle="No roster records." />
        )}
      </section>
    </div>
  );
}

function ShiftPill({ shift, staffMember }: { shift: EmployeeShift; staffMember?: StaffUser }) {
  return (
    <div className="rounded bg-slate-50 px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">{staffMember?.name ?? compactId(shift.user_id)}</span>
        <Badge variant={shiftVariant(shift.status)}>{titleCase(shift.status)}</Badge>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {timeLabel(shift.shift_start)} - {timeLabel(shift.shift_end)}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function filterShiftsByView(shifts: EmployeeShift[], viewMode: string) {
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndKey = weekEnd.toISOString().slice(0, 10);

  return shifts
    .filter((shift) => {
      if (viewMode === "daily") {
        return shift.shift_date === today;
      }
      if (viewMode === "weekly") {
        return shift.shift_date >= today && shift.shift_date <= weekEndKey;
      }
      return true;
    })
    .slice()
    .sort((a, b) => `${a.shift_date}${a.shift_start}`.localeCompare(`${b.shift_date}${b.shift_start}`));
}

function groupByDate(shifts: EmployeeShift[]) {
  const groups = new Map<string, EmployeeShift[]>();
  shifts.forEach((shift) => {
    groups.set(shift.shift_date, [...(groups.get(shift.shift_date) ?? []), shift]);
  });
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function timeLabel(value: string) {
  const normalized = value.includes("T") ? value : `2026-01-01T${value}`;
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date(normalized));
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
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
