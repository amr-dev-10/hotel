"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, ChevronRight, Loader2, Repeat2, Save, UserRoundCheck, UsersRound, Wand2 } from "lucide-react";
import { useForm } from "react-hook-form";
import type { UseFormRegisterReturn } from "react-hook-form";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  bulkDefaultShiftAssignmentSchema,
  shiftAssignmentSchema,
  shiftTemplateSchema,
  type BulkDefaultShiftAssignmentValues,
  type ShiftAssignmentValues,
  type ShiftTemplateValues,
} from "@/features/staff/schemas/attendance.schema";
import {
  useBulkAssignDefaultShift,
  useCreateShiftAssignment,
  useCreateShiftTemplate,
  useShiftAssignments,
  useShiftTemplates,
} from "@/features/staff/hooks/useAttendance";
import { useStaff } from "@/features/staff/hooks/useStaff";
import { showApiErrorToast } from "@/lib/api/error-toast";
import type { ShiftAssignment, ShiftTemplate, StaffUser } from "@/types/domain";

const DEFAULT_WORKING_DAYS = [0, 1, 2, 3, 4, 5];
const SHIFT_TEMPLATE_PAGE_SIZE = 8;
const SHIFT_ASSIGNMENT_PAGE_SIZE = 10;
const SHIFT_EMPLOYEE_PAGE_SIZE = 10;

export function StaffShiftsPage({ hotelId }: { hotelId: string }) {
  const staff = useStaff(hotelId);
  const templates = useShiftTemplates(hotelId);
  const assignments = useShiftAssignments(hotelId);
  const createTemplate = useCreateShiftTemplate(hotelId);
  const createAssignment = useCreateShiftAssignment(hotelId);
  const bulkAssignDefault = useBulkAssignDefaultShift(hotelId);

  const today = new Date().toISOString().slice(0, 10);
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
      is_default: true,
      is_active: true,
    },
  });
  const assignmentForm = useForm<ShiftAssignmentValues>({
    resolver: zodResolver(shiftAssignmentSchema),
    defaultValues: {
      employee_id: "",
      shift_template_id: "",
      effective_from: today,
      effective_to: "",
      working_days: DEFAULT_WORKING_DAYS,
      rotation_type: "fixed",
      is_active: true,
    },
  });
  const bulkForm = useForm<BulkDefaultShiftAssignmentValues>({
    resolver: zodResolver(bulkDefaultShiftAssignmentSchema),
    defaultValues: {
      shift_template_id: "",
      effective_from: today,
      effective_to: "",
      working_days: DEFAULT_WORKING_DAYS,
      rotation_type: "fixed",
      overwrite_existing: false,
      include_admins: false,
    },
  });

  const eligibleStaff = useMemo(() => (staff.data ?? []).filter(isBulkEligibleEmployee), [staff.data]);
  const activeAssignmentEmployeeIds = useMemo(
    () => new Set((assignments.data ?? []).filter((assignment) => assignment.is_active).map((assignment) => assignment.employee_id)),
    [assignments.data],
  );
  const metrics = useMemo(
    () => ({
      employees: eligibleStaff.length,
      templates: templates.data?.length ?? 0,
      assigned: activeAssignmentEmployeeIds.size,
      missing: eligibleStaff.filter((user) => !activeAssignmentEmployeeIds.has(user.id)).length,
    }),
    [activeAssignmentEmployeeIds, eligibleStaff, templates.data?.length],
  );
  const defaultTemplate = (templates.data ?? []).find((template) => template.is_default);
  const selectedWorkingDays = assignmentForm.watch("working_days") ?? [];
  const selectedBulkWorkingDays = bulkForm.watch("working_days") ?? [];

  const onTemplateSubmit = templateForm.handleSubmit(async (values) => {
    try {
      await createTemplate.mutateAsync({
        ...values,
        code: values.code.toUpperCase(),
      });
      toast.success(values.is_default ? "Default shift template saved" : "Shift template saved");
      templateForm.reset({
        ...values,
        name: "",
        code: "",
        is_default: false,
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

  const onBulkSubmit = bulkForm.handleSubmit(async (values) => {
    try {
      const result = await bulkAssignDefault.mutateAsync({
        ...values,
        shift_template_id: values.shift_template_id || undefined,
        effective_to: values.effective_to || undefined,
        working_days: selectedBulkWorkingDays,
      });
      toast.success(`Assigned ${result.created} employees, skipped ${result.skipped}`);
    } catch (error) {
      showApiErrorToast(error);
    }
  });

  function toggleWorkingDay(day: number) {
    assignmentForm.setValue("working_days", toggleDay(selectedWorkingDays, day), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function toggleBulkWorkingDay(day: number) {
    bulkForm.setValue("working_days", toggleDay(selectedBulkWorkingDays, day), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  if (staff.isLoading || templates.isLoading || assignments.isLoading) {
    return <DataState isLoading />;
  }

  if (staff.error || templates.error || assignments.error) {
    return <DataState error={staff.error ?? templates.error ?? assignments.error} />;
  }

  return (
    <div className="grid gap-5">
      <PageBreadcrumbs
        current="Shift Management"
        description="Recurring attendance roster and default shift assignment."
        hotelId={hotelId}
        items={[
          { label: "Settings" },
          { label: "Staff Management", href: `/${hotelId}/settings/staff` },
        ]}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Employees" value={metrics.employees} />
        <Metric label="Assigned" value={metrics.assigned} />
        <Metric label="Missing" value={metrics.missing} />
        <Metric label="Templates" value={metrics.templates} />
      </div>

      <form className="grid gap-4 rounded-md border border-slate-200 bg-white p-4" onSubmit={onBulkSubmit}>
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2">
            <Wand2 className="size-4 text-slate-500" />
            <div>
              <h3 className="text-base font-semibold">Bulk Default Shift</h3>
              <p className="text-sm text-slate-500">
                {defaultTemplate
                  ? `${defaultTemplate.name} is the current default template.`
                  : "No default exists yet. Running this creates Morning Shift automatically."}
              </p>
            </div>
          </div>
          <Button disabled={bulkAssignDefault.isPending} type="submit">
            {bulkAssignDefault.isPending ? <Loader2 className="animate-spin" /> : <UsersRound />}
            Assign default
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Template" id="bulk-template">
            <Select id="bulk-template" {...bulkForm.register("shift_template_id")}>
              <option value="">Use default / create Morning</option>
              {(templates.data ?? []).map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Effective from" id="bulk-from">
            <Input id="bulk-from" type="date" {...bulkForm.register("effective_from")} />
          </Field>
          <Field label="Effective to" id="bulk-to">
            <Input id="bulk-to" type="date" {...bulkForm.register("effective_to")} />
          </Field>
          <Field label="Rotation" id="bulk-rotation">
            <Select id="bulk-rotation" {...bulkForm.register("rotation_type")}>
              <option value="fixed">Fixed</option>
              <option value="weekly">Weekly</option>
              <option value="custom">Custom</option>
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-end">
          <WorkingDayPicker selectedDays={selectedBulkWorkingDays} onToggle={toggleBulkWorkingDay} />
          <div className="flex flex-wrap gap-3">
            <Checkbox label="Overwrite existing" registration={bulkForm.register("overwrite_existing")} />
            <Checkbox label="Include admins" registration={bulkForm.register("include_admins")} />
          </div>
        </div>
      </form>

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
            <div className="grid gap-2">
              <Checkbox label="Night shift" registration={templateForm.register("is_night_shift")} />
              <Checkbox label="Default template" registration={templateForm.register("is_default")} />
            </div>
          </div>
        </form>

        <form className="grid gap-4 rounded-md border border-slate-200 bg-white p-4" onSubmit={onAssignmentSubmit}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserRoundCheck className="size-4 text-slate-500" />
              <h3 className="text-base font-semibold">Assign Employee</h3>
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
            <div className="md:col-span-2">
              <WorkingDayPicker selectedDays={selectedWorkingDays} onToggle={toggleWorkingDay} />
            </div>
          </div>
        </form>
      </section>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <Repeat2 className="size-4 text-slate-500" />
          <h3 className="text-base font-semibold">Recurring Roster</h3>
        </div>
        <div className="grid items-stretch gap-4 xl:grid-cols-3">
          <EmployeeAssignmentList employees={eligibleStaff} assignedEmployeeIds={activeAssignmentEmployeeIds} />
          <TemplateList templates={templates.data ?? []} />
          <AssignmentList assignments={assignments.data ?? []} />
        </div>
      </section>
    </div>
  );
}

function TemplateList({ templates }: { templates: ShiftTemplate[] }) {
  const { currentPage, paginatedItems, setPage } = useClientPagination(templates, SHIFT_TEMPLATE_PAGE_SIZE);

  return (
    <div className="flex min-h-full min-w-0 flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Templates</p>
      {templates.length ? (
        <>
          {paginatedItems.map((template) => (
            <div className="rounded-md border border-slate-200 px-3 py-2 text-sm" key={template.id}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{template.name}</span>
                <span className="flex shrink-0 gap-1">
                  {template.is_default ? <Badge variant="blue">Default</Badge> : null}
                  <Badge variant={template.is_active ? "green" : "default"}>{template.code}</Badge>
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {timeLabel(template.start_time)} - {timeLabel(template.end_time)}
              </p>
            </div>
          ))}
          {templates.length > SHIFT_TEMPLATE_PAGE_SIZE ? (
            <RosterPaginationControls
              page={currentPage}
              pageSize={SHIFT_TEMPLATE_PAGE_SIZE}
              totalItems={templates.length}
              onPageChange={setPage}
            />
          ) : null}
        </>
      ) : (
        <DataState empty emptyTitle="No shift templates." />
      )}
    </div>
  );
}

function AssignmentList({ assignments }: { assignments: ShiftAssignment[] }) {
  const { currentPage, paginatedItems, setPage } = useClientPagination(assignments, SHIFT_ASSIGNMENT_PAGE_SIZE);

  return (
    <div className="flex min-h-full min-w-0 flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Assignments</p>
      {assignments.length ? (
        <>
          {paginatedItems.map((assignment) => (
            <div className="rounded-md border border-slate-200 px-3 py-2 text-sm" key={assignment.id}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{assignment.employee_name ?? assignment.employee_code ?? "Unknown staff"}</span>
                <Badge variant={assignment.is_active ? "blue" : "default"}>{assignment.template_code ?? "Template"}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {assignment.template_name ?? "Assigned shift"} - {workingDayLabel(assignment.working_days)}
              </p>
            </div>
          ))}
          {assignments.length > SHIFT_ASSIGNMENT_PAGE_SIZE ? (
            <RosterPaginationControls
              page={currentPage}
              pageSize={SHIFT_ASSIGNMENT_PAGE_SIZE}
              totalItems={assignments.length}
              onPageChange={setPage}
            />
          ) : null}
        </>
      ) : (
        <DataState empty emptyTitle="No recurring assignments." />
      )}
    </div>
  );
}

function EmployeeAssignmentList({
  employees,
  assignedEmployeeIds,
}: {
  employees: StaffUser[];
  assignedEmployeeIds: Set<string>;
}) {
  const { currentPage, paginatedItems, setPage } = useClientPagination(employees, SHIFT_EMPLOYEE_PAGE_SIZE);

  return (
    <div className="flex min-h-full min-w-0 flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Employees</p>
      {employees.length ? (
        <>
          {paginatedItems.map((employee) => {
            const isAssigned = assignedEmployeeIds.has(employee.id);
            return (
              <div className="rounded-md border border-slate-200 px-3 py-2 text-sm" key={employee.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{employee.name}</span>
                  <Badge variant={isAssigned ? "green" : "amber"}>{isAssigned ? "Assigned" : "Missing"}</Badge>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{employee.employee_code ?? employee.email}</p>
              </div>
            );
          })}
          {employees.length > SHIFT_EMPLOYEE_PAGE_SIZE ? (
            <RosterPaginationControls
              page={currentPage}
              pageSize={SHIFT_EMPLOYEE_PAGE_SIZE}
              totalItems={employees.length}
              onPageChange={setPage}
            />
          ) : null}
        </>
      ) : (
        <DataState empty emptyTitle="No eligible employees." />
      )}
    </div>
  );
}

function RosterPaginationControls({
  page,
  pageSize,
  totalItems,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(page, 1), pageCount);

  return (
    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
      <span className="font-semibold uppercase tracking-normal">Total {totalItems}</span>
      <div className="flex items-center gap-1">
        <Button
          aria-label="Previous page"
          disabled={currentPage <= 1}
          size="iconSm"
          type="button"
          variant="ghost"
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft />
        </Button>
        <span className="min-w-20 rounded border border-[var(--primary)] bg-[var(--primary-soft)] px-2 py-1 text-center font-bold uppercase tracking-normal text-[var(--primary)]">
          Page {currentPage} / {pageCount}
        </span>
        <Button
          aria-label="Next page"
          disabled={currentPage >= pageCount}
          size="iconSm"
          type="button"
          variant="ghost"
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

function useClientPagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);

  useEffect(() => {
    setPage(1);
  }, [items]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [currentPage, items, pageSize]);

  return { currentPage, paginatedItems, setPage };
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

function Checkbox({
  label,
  registration,
}: {
  label: string;
  registration: UseFormRegisterReturn;
}) {
  return (
    <label className="flex min-h-10 items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
      <input className="size-4 accent-[var(--primary)]" type="checkbox" {...registration} />
      {label}
    </label>
  );
}

function WorkingDayPicker({
  selectedDays,
  onToggle,
}: {
  selectedDays: number[];
  onToggle: (day: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>Working days</Label>
      <div className="flex flex-wrap gap-2">
        {WEEK_DAYS.map((day) => (
          <Button
            key={day.value}
            size="sm"
            type="button"
            variant={selectedDays.includes(day.value) ? "default" : "secondary"}
            onClick={() => onToggle(day.value)}
          >
            {day.label}
          </Button>
        ))}
      </div>
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

function isBulkEligibleEmployee(user: StaffUser) {
  return user.is_active && !user.is_hotel_owner && user.user_type === "HOTEL_EMPLOYEE";
}

function toggleDay(selectedDays: number[], day: number) {
  return selectedDays.includes(day)
    ? selectedDays.filter((item) => item !== day)
    : [...selectedDays, day].sort((a, b) => a - b);
}

function workingDayLabel(values: number[]) {
  const labels = WEEK_DAYS.filter((day) => values.includes(day.value)).map((day) => day.label);
  return labels.length ? labels.join(", ") : "No days";
}

function timeLabel(value: string) {
  const normalized = value.includes("T") ? value : `2026-01-01T${value}`;
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date(normalized));
}
