"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, Loader2, Repeat2, Save, UserRoundCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { showApiErrorToast } from "@/lib/api/error-toast";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { titleCase } from "@/lib/utils";
import { useDepartments } from "@/features/departments/hooks/useDepartments";
import {
  shiftAssignmentSchema,
  shiftTemplateSchema,
  type ShiftAssignmentValues,
  type ShiftTemplateValues,
} from "@/features/staff/schemas/attendance.schema";
import { shiftSchema, type ShiftValues } from "@/features/staff/schemas/create-staff.schema";
import {
  useCreateShiftAssignment,
  useCreateShiftTemplate,
  useShiftAssignments,
  useShiftTemplates,
} from "@/features/staff/hooks/useAttendance";
import { useCreateShift, useShifts, useStaff } from "@/features/staff/hooks/useStaff";
import type { EmployeeShift, ShiftAssignment, ShiftTemplate, StaffUser } from "@/types/domain";

export function StaffShiftsPage({ hotelId }: { hotelId: string }) {
  const staff = useStaff(hotelId);
  const departments = useDepartments(hotelId);
  const shifts = useShifts(hotelId);
  const templates = useShiftTemplates(hotelId);
  const assignments = useShiftAssignments(hotelId);
  const createShift = useCreateShift(hotelId);
  const createTemplate = useCreateShiftTemplate(hotelId);
  const createAssignment = useCreateShiftAssignment(hotelId);
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
  const templateForm = useForm<ShiftTemplateValues>({
    resolver: zodResolver(shiftTemplateSchema),
    defaultValues: {
      name: "Morning Shift",
      code: "MORNING",
      start_time: "09:00",
      end_time: "17:00",
      break_minutes: 30,
      grace_minutes: 10,
      late_after_minutes: 10,
      is_night_shift: false,
      is_active: true,
    },
  });
  const assignmentForm = useForm<ShiftAssignmentValues>({
    resolver: zodResolver(shiftAssignmentSchema),
    defaultValues: {
      employee_id: "",
      shift_template_id: "",
      effective_from: new Date().toISOString().slice(0, 10),
      effective_to: "",
      working_days: [0, 1, 2, 3, 4, 5],
      rotation_type: "fixed",
      is_active: true,
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
  const selectedWorkingDays = assignmentForm.watch("working_days") ?? [];

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
      showApiErrorToast(error);
    }
  });

  const onTemplateSubmit = templateForm.handleSubmit(async (values) => {
    try {
      await createTemplate.mutateAsync({
        ...values,
        code: values.code.toUpperCase(),
      });
      toast.success("Shift template created");
      templateForm.reset({
        ...values,
        name: "",
        code: "",
      });
    } catch (error) {
      showApiErrorToast(error);
    }
  });

  const onAssignmentSubmit = assignmentForm.handleSubmit(async (values) => {
    try {
      await createAssignment.mutateAsync({
        ...values,
        effective_to: values.effective_to || undefined,
        working_days: selectedWorkingDays,
      });
      toast.success("Shift assignment created");
      assignmentForm.reset({
        ...values,
        employee_id: "",
        effective_to: "",
      });
    } catch (error) {
      showApiErrorToast(error);
    }
  });

  function toggleWorkingDay(day: number) {
    const next = selectedWorkingDays.includes(day)
      ? selectedWorkingDays.filter((item) => item !== day)
      : [...selectedWorkingDays, day].sort((a, b) => a - b);
    assignmentForm.setValue("working_days", next, { shouldDirty: true, shouldValidate: true });
  }

  if (staff.isLoading || departments.isLoading || shifts.isLoading || templates.isLoading || assignments.isLoading) {
    return <DataState isLoading />;
  }

  if (staff.error || departments.error || shifts.error || templates.error || assignments.error) {
    return <DataState error={staff.error ?? departments.error ?? shifts.error ?? templates.error ?? assignments.error} />;
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <PageBreadcrumbs
          current="Shift Management"
          description="Calendar and roster planning for hotel teams."
          hotelId={hotelId}
          items={[
            { label: "Settings" },
            { label: "Staff Management", href: `/${hotelId}/settings/staff` },
          ]}
        />
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

      <section className="grid gap-4 xl:grid-cols-2">
        <form className="grid gap-4 rounded-md border border-slate-200 bg-white p-4" onSubmit={onTemplateSubmit}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Repeat2 className="size-4 text-slate-500" />
              <h3 className="text-base font-semibold">Shift Template</h3>
            </div>
            <Button disabled={createTemplate.isPending} type="submit">
              {createTemplate.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Save template
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name" id="template-name">
              <Input id="template-name" {...templateForm.register("name")} />
            </Field>
            <Field label="Code" id="template-code">
              <Input id="template-code" {...templateForm.register("code")} />
            </Field>
            <Field label="Start time" id="template-start">
              <Input id="template-start" type="time" {...templateForm.register("start_time")} />
            </Field>
            <Field label="End time" id="template-end">
              <Input id="template-end" type="time" {...templateForm.register("end_time")} />
            </Field>
            <Field label="Break minutes" id="template-break">
              <Input id="template-break" min={0} type="number" {...templateForm.register("break_minutes", { valueAsNumber: true })} />
            </Field>
            <Field label="Grace minutes" id="template-grace">
              <Input id="template-grace" min={0} type="number" {...templateForm.register("grace_minutes", { valueAsNumber: true })} />
            </Field>
            <Field label="Late after" id="template-late">
              <Input id="template-late" min={0} type="number" {...templateForm.register("late_after_minutes", { valueAsNumber: true })} />
            </Field>
            <label className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
              <input className="size-4 accent-[var(--primary)]" type="checkbox" {...templateForm.register("is_night_shift")} />
              Night shift
            </label>
          </div>
        </form>

        <form className="grid gap-4 rounded-md border border-slate-200 bg-white p-4" onSubmit={onAssignmentSubmit}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserRoundCheck className="size-4 text-slate-500" />
              <h3 className="text-base font-semibold">Assign Template</h3>
            </div>
            <Button disabled={createAssignment.isPending} type="submit">
              {createAssignment.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Save assignment
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Employee" id="assignment-user">
              <Select id="assignment-user" {...assignmentForm.register("employee_id")}>
                <option value="">Select employee</option>
                {(staff.data ?? []).map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Template" id="assignment-template">
              <Select id="assignment-template" {...assignmentForm.register("shift_template_id")}>
                <option value="">Select template</option>
                {(templates.data ?? []).map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Effective from" id="assignment-from">
              <Input id="assignment-from" type="date" {...assignmentForm.register("effective_from")} />
            </Field>
            <Field label="Effective to" id="assignment-to">
              <Input id="assignment-to" type="date" {...assignmentForm.register("effective_to")} />
            </Field>
            <div className="grid gap-2 md:col-span-2">
              <Label>Working days</Label>
              <div className="flex flex-wrap gap-2">
                {WEEK_DAYS.map((day) => (
                  <Button
                    key={day.value}
                    size="sm"
                    type="button"
                    variant={selectedWorkingDays.includes(day.value) ? "default" : "secondary"}
                    onClick={() => toggleWorkingDay(day.value)}
                  >
                    {day.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </form>
      </section>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <Repeat2 className="size-4 text-slate-500" />
          <h3 className="text-base font-semibold">Recurring Roster</h3>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <TemplateList templates={templates.data ?? []} />
          <AssignmentList assignments={assignments.data ?? []} />
        </div>
      </section>

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
              <span className="truncate font-medium">{staffById.get(shift.user_id)?.name ?? "Unknown staff"}</span>
              <span className="truncate text-slate-600">
                {shift.department_id ? departmentById.get(shift.department_id) ?? "Auto" : "Auto"}
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
        <span className="truncate font-medium">{staffMember?.name ?? "Unknown staff"}</span>
        <Badge variant={shiftVariant(shift.status)}>{titleCase(shift.status)}</Badge>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {timeLabel(shift.shift_start)} - {timeLabel(shift.shift_end)}
      </p>
    </div>
  );
}

function TemplateList({ templates }: { templates: ShiftTemplate[] }) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Templates</p>
      {templates.length ? (
        templates.map((template) => (
          <div className="rounded-md border border-slate-200 px-3 py-2 text-sm" key={template.id}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{template.name}</span>
              <Badge variant={template.is_active ? "green" : "default"}>{template.code}</Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {timeLabel(template.start_time)} - {timeLabel(template.end_time)}
            </p>
          </div>
        ))
      ) : (
        <DataState empty emptyTitle="No shift templates." />
      )}
    </div>
  );
}

function AssignmentList({ assignments }: { assignments: ShiftAssignment[] }) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Assignments</p>
      {assignments.length ? (
        assignments.map((assignment) => (
          <div className="rounded-md border border-slate-200 px-3 py-2 text-sm" key={assignment.id}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{assignment.employee_name ?? assignment.employee_code ?? "Unknown staff"}</span>
              <Badge variant={assignment.is_active ? "blue" : "default"}>{assignment.template_code ?? "Template"}</Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {assignment.template_name ?? "Assigned shift"} · {workingDayLabel(assignment.working_days)}
            </p>
          </div>
        ))
      ) : (
        <DataState empty emptyTitle="No recurring assignments." />
      )}
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

const WEEK_DAYS = [
  { value: 0, label: "Mon" },
  { value: 1, label: "Tue" },
  { value: 2, label: "Wed" },
  { value: 3, label: "Thu" },
  { value: 4, label: "Fri" },
  { value: 5, label: "Sat" },
  { value: 6, label: "Sun" },
];

function workingDayLabel(values: number[]) {
  const labels = WEEK_DAYS.filter((day) => values.includes(day.value)).map((day) => day.label);
  return labels.length ? labels.join(", ") : "No days";
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
