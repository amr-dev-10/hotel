"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Activity,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  History,
  Loader2,
  Pencil,
  Save,
  ShieldCheck,
  TicketCheck,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiErrorMessage } from "@/lib/api/client";
import { Can } from "@/lib/auth/can";
import { cn, compactId, titleCase } from "@/lib/utils";
import { useDepartments } from "@/features/departments/hooks/useDepartments";
import { useAssignUserRoles, useRoles } from "@/features/roles/hooks/useRoles";
import { updateStaffSchema, type UpdateStaffValues } from "@/features/staff/schemas/create-staff.schema";
import {
  useDeleteStaff,
  useShifts,
  useStaff,
  useUpdateStaff,
} from "@/features/staff/hooks/useStaff";
import { useTickets } from "@/features/tickets/hooks/useTickets";
import type { Department, EmployeeShift, Role, StaffUser, Ticket } from "@/types/domain";

const ticketFilters = {};

const profileTabs = [
  { key: "overview", label: "Overview", icon: Activity },
  { key: "tickets", label: "Tickets", icon: TicketCheck },
  { key: "attendance", label: "Attendance", icon: ClipboardCheck },
  { key: "shifts", label: "Shifts", icon: CalendarClock },
  { key: "performance", label: "Performance", icon: Activity },
  { key: "activity", label: "Activity", icon: History },
  { key: "permissions", label: "Permissions", icon: ShieldCheck },
  { key: "audit", label: "Audit", icon: CheckCircle2 },
] as const;

export type StaffProfileTab = (typeof profileTabs)[number]["key"];

export function StaffProfilePage({
  hotelId,
  staffId,
  defaultTab = "overview",
}: {
  hotelId: string;
  staffId: string;
  defaultTab?: StaffProfileTab;
}) {
  const router = useRouter();
  const staff = useStaff(hotelId);
  const roles = useRoles(hotelId);
  const departments = useDepartments(hotelId);
  const tickets = useTickets(hotelId, ticketFilters);
  const shifts = useShifts(hotelId);
  const updateStaff = useUpdateStaff(hotelId, staffId);
  const deleteStaff = useDeleteStaff(hotelId);
  const assignRoles = useAssignUserRoles(hotelId, staffId);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<StaffProfileTab>(defaultTab);
  const user = useMemo(() => staff.data?.find((item) => item.id === staffId), [staff.data, staffId]);
  const staffById = useMemo(() => new Map((staff.data ?? []).map((item) => [item.id, item])), [staff.data]);
  const departmentById = useMemo(
    () => new Map((departments.data ?? []).map((item) => [item.id, item])),
    [departments.data],
  );
  const assignedTickets = useMemo(
    () => (tickets.data ?? []).filter((ticket) => ticket.assigned_to === staffId),
    [staffId, tickets.data],
  );
  const userShifts = useMemo(
    () => (shifts.data ?? []).filter((shift) => shift.user_id === staffId),
    [shifts.data, staffId],
  );
  const metrics = useMemo(() => buildStaffMetrics(user, assignedTickets, userShifts), [
    assignedTickets,
    user,
    userShifts,
  ]);
  const department = user?.department_id ? departmentById.get(user.department_id) : undefined;
  const manager = user?.reports_to ? staffById.get(user.reports_to) : undefined;
  const form = useForm<UpdateStaffValues>({
    resolver: zodResolver(updateStaffSchema),
    defaultValues: {
      name: "",
      email: "",
      department_id: "",
      reports_to: "",
      staff_level: "attendant",
      job_role: "",
      is_on_duty: false,
      is_active: true,
    },
  });

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (!user) {
      return;
    }

    form.reset({
      name: user.name,
      email: user.email,
      department_id: user.department_id ?? "",
      reports_to: user.reports_to ?? "",
      staff_level: normalizeStaffLevel(user.staff_level),
      job_role: user.job_role ?? "",
      is_on_duty: user.is_on_duty,
      is_active: user.is_active,
    });
    setSelectedRoles((user.roles ?? []).map((role) => role.id).sort());
  }, [form, user]);

  async function handleAssignRoles() {
    try {
      await assignRoles.mutateAsync(selectedRoles);
      toast.success("Role assignment saved");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateStaff.mutateAsync({
        ...values,
        department_id: values.department_id || undefined,
        reports_to: values.reports_to || undefined,
        job_role: values.job_role || undefined,
      });
      toast.success("Staff profile updated");
      setEditing(false);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  });

  async function handleDelete() {
    if (!user || !window.confirm(`Delete ${user.name}?`)) {
      return;
    }

    try {
      await deleteStaff.mutateAsync(user.id);
      toast.success("Staff member deleted");
      router.push(`/${hotelId}/settings/staff`);
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
        <div className="flex flex-wrap gap-2">
          <Badge variant={user.is_active ? "green" : "rose"}>{user.is_active ? "Active" : "Inactive"}</Badge>
          <Badge variant={user.is_on_duty ? "blue" : "default"}>{user.is_on_duty ? "On duty" : "Off duty"}</Badge>
          <Can I="edit" a="Staff">
            <Button type="button" variant="secondary" onClick={() => setEditing((value) => !value)}>
              {editing ? <X /> : <Pencil />}
              {editing ? "Close edit" : "Edit"}
            </Button>
          </Can>
          <Can I="delete" a="Staff">
            <Button disabled={deleteStaff.isPending} type="button" variant="danger" onClick={handleDelete}>
              {deleteStaff.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete
            </Button>
          </Can>
        </div>
      </div>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 lg:grid-cols-[1.2fr_2fr]">
        <div className="flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-[#0F3D91] text-xl font-semibold text-white">
            {initials(user.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{user.name}</p>
            <p className="truncate text-sm text-slate-500">{user.job_role ?? "Staff"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="blue">{titleCase(user.staff_level)}</Badge>
              {user.is_hotel_owner ? <Badge variant="green">Hotel owner</Badge> : null}
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Department" value={department?.name ?? compactId(user.department_id)} />
          <Detail label="Reports to" value={manager?.name ?? compactId(user.reports_to)} />
          <Detail label="Open tickets" value={String(metrics.openTickets)} />
          <Detail label="Attendance" value={`${metrics.attendancePercent}%`} />
        </div>
      </section>

      {editing ? (
        <form className="grid gap-4 rounded-md border border-slate-200 bg-white p-4" onSubmit={onSubmit}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold">Edit Staff</h3>
            <Button disabled={updateStaff.isPending} type="submit">
              {updateStaff.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Save
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name" id="profile-name">
              <Input id="profile-name" {...form.register("name")} />
            </Field>
            <Field label="Email" id="profile-email">
              <Input id="profile-email" type="email" {...form.register("email")} />
            </Field>
            <Field label="Job role" id="profile-job-role">
              <Input id="profile-job-role" {...form.register("job_role")} />
            </Field>
            <Field label="Staff level" id="profile-staff-level">
              <Select id="profile-staff-level" {...form.register("staff_level")}>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="supervisor">Supervisor</option>
                <option value="attendant">Attendant</option>
              </Select>
            </Field>
            <Field label="Department" id="profile-department">
              <Select id="profile-department" {...form.register("department_id")}>
                <option value="">Unassigned</option>
                {(departments.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Reports to" id="profile-reports-to">
              <Select id="profile-reports-to" {...form.register("reports_to")}>
                <option value="">None</option>
                {(staff.data ?? [])
                  .filter((item) => item.id !== user.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <label className="flex items-center gap-2 rounded-md border border-slate-200 p-3 text-sm">
              <input className="size-4 accent-[#0F3D91]" type="checkbox" {...form.register("is_on_duty")} />
              On duty
            </label>
            <label className="flex items-center gap-2 rounded-md border border-slate-200 p-3 text-sm">
              <input className="size-4 accent-[#0F3D91]" type="checkbox" {...form.register("is_active")} />
              Active
            </label>
          </div>
        </form>
      ) : null}

      <div className="flex gap-2 overflow-x-auto rounded-md border border-slate-200 bg-white p-2">
        {profileTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              aria-pressed={active}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100",
                active && "bg-[#0F3D91] text-white hover:bg-[#0F3D91]",
              )}
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" ? (
        <OverviewPanel
          department={department}
          manager={manager}
          metrics={metrics}
          shifts={userShifts}
          tickets={assignedTickets}
          user={user}
        />
      ) : null}
      {activeTab === "tickets" ? (
        <TicketsPanel departmentById={departmentById} error={tickets.error} isLoading={tickets.isLoading} tickets={assignedTickets} />
      ) : null}
      {activeTab === "attendance" ? (
        <AttendancePanel error={shifts.error} isLoading={shifts.isLoading} shifts={userShifts} user={user} />
      ) : null}
      {activeTab === "shifts" ? (
        <ShiftsPanel error={shifts.error} isLoading={shifts.isLoading} shifts={userShifts} />
      ) : null}
      {activeTab === "performance" ? <PerformancePanel metrics={metrics} tickets={assignedTickets} /> : null}
      {activeTab === "activity" ? <ActivityPanel shifts={userShifts} tickets={assignedTickets} user={user} /> : null}
      {activeTab === "permissions" ? (
        <PermissionsPanel
          assignPending={assignRoles.isPending}
          onSave={handleAssignRoles}
          onToggleRole={toggleRole}
          roles={roles.data ?? []}
          selectedRoles={selectedRoles}
        />
      ) : null}
      {activeTab === "audit" ? <AuditPanel department={department} manager={manager} user={user} /> : null}
    </div>
  );
}

function PerformancePanel({
  metrics,
  tickets,
}: {
  metrics: StaffMetrics;
  tickets: Ticket[];
}) {
  const workloadScore = Math.max(0, 100 - metrics.openTickets * 12 - metrics.escalatedTickets * 8);
  const trend = buildTicketTrend(tickets);

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard icon={CheckCircle2} label="Tickets completed" value={metrics.closedTickets} />
        <MetricCard icon={UserCheck} label="Guest satisfaction" value="0%" />
        <MetricCard icon={Clock3} label="Avg resolution" value={metrics.avgResolutionLabel} />
        <MetricCard icon={ClipboardCheck} label="Attendance score" value={`${metrics.attendancePercent}%`} />
        <MetricCard icon={Activity} label="Escalations" value={metrics.escalatedTickets} />
        <MetricCard icon={TicketCheck} label="Workload score" value={`${workloadScore}%`} />
      </div>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold">Ticket Trends</h3>
        <div className="grid gap-3 md:grid-cols-7">
          {trend.map((item) => (
            <div className="grid gap-2" key={item.label}>
              <div className="flex h-32 items-end rounded bg-slate-50 p-2">
                <div
                  className="w-full rounded bg-[#0F3D91]"
                  style={{ height: `${Math.max(8, item.value * 16)}px` }}
                />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                <p className="text-sm font-semibold">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function OverviewPanel({
  user,
  department,
  manager,
  metrics,
  tickets,
  shifts,
}: {
  user: StaffUser;
  department?: Department;
  manager?: StaffUser;
  metrics: StaffMetrics;
  tickets: Ticket[];
  shifts: EmployeeShift[];
}) {
  const latestTickets = tickets.slice(0, 5);
  const nextShift = shifts
    .slice()
    .sort((a, b) => a.shift_date.localeCompare(b.shift_date))
    .find((shift) => !["completed", "absent"].includes(shift.status));

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        <MetricCard icon={TicketCheck} label="Assigned" value={metrics.assignedTickets} />
        <MetricCard icon={Clock3} label="Open" value={metrics.openTickets} />
        <MetricCard icon={CheckCircle2} label="Closed" value={metrics.closedTickets} />
        <MetricCard icon={Activity} label="Escalated" value={metrics.escalatedTickets} />
        <MetricCard icon={Clock3} label="Avg resolution" value={metrics.avgResolutionLabel} />
        <MetricCard icon={ClipboardCheck} label="Attendance" value={`${metrics.attendancePercent}%`} />
        <MetricCard icon={CalendarClock} label="Hours" value={metrics.hoursThisMonth} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1.5fr]">
        <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold">Workforce Profile</h3>
          <div className="grid gap-2">
            <DetailRow label="Employee code" value={compactId(user.id)} />
            <DetailRow label="Department" value={department?.name ?? compactId(user.department_id)} />
            <DetailRow label="Manager" value={manager?.name ?? compactId(user.reports_to)} />
            <DetailRow label="Next shift" value={nextShift ? `${dateLabel(nextShift.shift_date)} ${timeLabel(nextShift.shift_start)}` : "None"} />
          </div>
        </section>

        <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold">Recent Tickets</h3>
          {latestTickets.length ? (
            <div className="grid gap-2">
              {latestTickets.map((ticket) => (
                <TicketRow key={ticket.id} ticket={ticket} />
              ))}
            </div>
          ) : (
            <DataState empty emptyTitle="No assigned tickets." />
          )}
        </section>
      </div>
    </div>
  );
}

function TicketsPanel({
  tickets,
  departmentById,
  isLoading,
  error,
}: {
  tickets: Ticket[];
  departmentById: Map<string, Department>;
  isLoading: boolean;
  error: unknown;
}) {
  const [statusFilter, setStatusFilter] = useState("open");
  const filteredTickets = tickets.filter((ticket) => {
    if (statusFilter === "all") {
      return true;
    }
    if (statusFilter === "closed") {
      return isTicketClosed(ticket);
    }
    if (statusFilter === "escalated") {
      return isTicketEscalated(ticket);
    }
    if (statusFilter === "accepted") {
      return ["accepted", "in_progress"].includes(ticket.stage.toLowerCase());
    }
    if (statusFilter === "pending") {
      return ticket.stage.toLowerCase().includes("pending");
    }
    return !isTicketClosed(ticket);
  });
  const closedToday = tickets.filter((ticket) => ticket.resolved_at && isToday(ticket.resolved_at)).length;
  const slaBreaches = tickets.filter((ticket) => ticket.sla_due_at && new Date(ticket.sla_due_at) < new Date() && !isTicketClosed(ticket)).length;

  if (isLoading) {
    return <DataState isLoading />;
  }

  if (error) {
    return <DataState error={error} />;
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard icon={Clock3} label="Open tickets" value={tickets.filter((ticket) => !isTicketClosed(ticket)).length} />
        <MetricCard icon={CheckCircle2} label="Closed today" value={closedToday} />
        <MetricCard icon={Activity} label="SLA breaches" value={slaBreaches} />
        <MetricCard icon={TicketCheck} label="Average resolution" value={averageResolutionLabel(tickets)} />
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {["open", "closed", "escalated", "accepted", "pending", "all"].map((item) => (
          <button
            aria-pressed={statusFilter === item}
            className={cn(
              "h-9 shrink-0 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600",
              statusFilter === item && "border-[#0F3D91] bg-[#0F3D91] text-white",
            )}
            key={item}
            type="button"
            onClick={() => setStatusFilter(item)}
          >
            {titleCase(item)}
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="grid grid-cols-[120px_1fr_150px_90px_140px_130px_140px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
          <span>Ticket ID</span>
          <span>Guest</span>
          <span>Department</span>
          <span>Priority</span>
          <span>Assigned date</span>
          <span>Status</span>
          <span>SLA</span>
        </div>
        {filteredTickets.length ? (
          filteredTickets.map((ticket) => (
            <div
              className="grid grid-cols-[120px_1fr_150px_90px_140px_130px_140px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
              key={ticket.id}
            >
              <span className="truncate font-semibold">{ticket.ticket_code}</span>
              <span className="truncate text-slate-600">{compactId(ticket.guest_id)}</span>
              <span className="truncate text-slate-600">
                {ticket.department_id ? departmentById.get(ticket.department_id)?.name ?? compactId(ticket.department_id) : "None"}
              </span>
              <PriorityBadge priority={ticket.priority} />
              <span className="truncate text-slate-600">{dateLabel(ticket.created_at)}</span>
              <Badge variant={stageVariant(ticket.stage)}>{titleCase(ticket.stage)}</Badge>
              <span className="truncate text-slate-600">{ticket.sla_due_at ? dateLabel(ticket.sla_due_at) : "Not set"}</span>
            </div>
          ))
        ) : (
          <DataState empty emptyTitle="No tickets in this view." />
        )}
      </section>
    </div>
  );
}

function AttendancePanel({
  user,
  shifts,
  isLoading,
  error,
}: {
  user: StaffUser;
  shifts: EmployeeShift[];
  isLoading: boolean;
  error: unknown;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const todayShift = shifts.find((shift) => shift.shift_date === today);
  const present = shifts.filter((shift) => ["checked_in", "completed"].includes(shift.status)).length;
  const absent = shifts.filter((shift) => shift.status === "absent").length;
  const late = shifts.filter((shift) => shift.status === "late").length;
  const onLeave = shifts.filter((shift) => shift.status === "on_leave").length;

  if (isLoading) {
    return <DataState isLoading />;
  }

  if (error) {
    return <DataState error={error} />;
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-6">
        <MetricCard icon={UserCheck} label="Present" value={present + (user.is_on_duty && !todayShift ? 1 : 0)} />
        <MetricCard icon={X} label="Absent" value={absent} />
        <MetricCard icon={Clock3} label="Late" value={late} />
        <MetricCard icon={CalendarClock} label="On leave" value={onLeave} />
        <MetricCard icon={CheckCircle2} label="Checked in" value={todayShift?.actual_start ? 1 : user.is_on_duty ? 1 : 0} />
        <MetricCard icon={ClipboardCheck} label="Checked out" value={todayShift?.actual_end ? 1 : 0} />
      </div>

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="grid grid-cols-[1fr_140px_140px_120px_140px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
          <span>Employee</span>
          <span>Check in</span>
          <span>Check out</span>
          <span>Hours</span>
          <span>Status</span>
        </div>
        {shifts.length ? (
          shifts.map((shift) => (
            <div
              className="grid grid-cols-[1fr_140px_140px_120px_140px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
              key={shift.id}
            >
              <span className="truncate font-medium">{dateLabel(shift.shift_date)}</span>
              <span className="truncate text-slate-600">{shift.actual_start ? timeLabel(shift.actual_start) : timeLabel(shift.shift_start)}</span>
              <span className="truncate text-slate-600">{shift.actual_end ? timeLabel(shift.actual_end) : timeLabel(shift.shift_end)}</span>
              <span className="truncate text-slate-600">{shiftHours(shift)}</span>
              <Badge variant={shiftVariant(shift.status)}>{titleCase(shift.status)}</Badge>
            </div>
          ))
        ) : (
          <DataState empty emptyTitle="No attendance records." />
        )}
      </section>
    </div>
  );
}

function ShiftsPanel({
  shifts,
  isLoading,
  error,
}: {
  shifts: EmployeeShift[];
  isLoading: boolean;
  error: unknown;
}) {
  if (isLoading) {
    return <DataState isLoading />;
  }

  if (error) {
    return <DataState error={error} />;
  }

  if (!shifts.length) {
    return <DataState empty emptyTitle="No shifts scheduled." />;
  }

  return (
    <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shifts.map((shift) => (
          <div className="rounded-md border border-slate-200 p-4" key={shift.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{dateLabel(shift.shift_date)}</p>
                <p className="text-sm text-slate-500">
                  {timeLabel(shift.shift_start)} - {timeLabel(shift.shift_end)}
                </p>
              </div>
              <Badge variant={shiftVariant(shift.status)}>{titleCase(shift.status)}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="blue">{titleCase(shift.shift_type)}</Badge>
              <Badge>{shiftHours(shift)}</Badge>
            </div>
            {shift.notes ? <p className="mt-3 text-sm text-slate-600">{shift.notes}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function ActivityPanel({
  user,
  tickets,
  shifts,
}: {
  user: StaffUser;
  tickets: Ticket[];
  shifts: EmployeeShift[];
}) {
  const events = buildActivity(user, tickets, shifts);

  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold">Activity Timeline</h3>
      <div className="grid gap-3">
        {events.map((event) => (
          <div className="grid grid-cols-[110px_1fr] gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm" key={`${event.time}-${event.label}`}>
            <span className="font-medium text-slate-500">{event.time}</span>
            <span>{event.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PermissionsPanel({
  roles,
  selectedRoles,
  assignPending,
  onToggleRole,
  onSave,
}: {
  roles: Role[];
  selectedRoles: string[];
  assignPending: boolean;
  onToggleRole: (roleId: string) => void;
  onSave: () => void;
}) {
  return (
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-base font-semibold">Role Assignment</h3>
          <p className="text-sm text-slate-500">Assign one or more roles to this staff account.</p>
        </div>
        <Button disabled={assignPending} type="button" onClick={onSave}>
          {assignPending ? <Loader2 className="animate-spin" /> : <Save />}
          Save roles
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((role) => (
          <label className="grid gap-3 rounded-md border border-slate-200 p-4" key={role.id}>
            <span className="flex items-start justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold">{role.name}</span>
                <span className="block text-xs text-slate-500">{role.description ?? "No description"}</span>
              </span>
              <input
                checked={selectedRoles.includes(role.id)}
                className="mt-1 size-4 accent-[#0F3D91]"
                type="checkbox"
                onChange={() => onToggleRole(role.id)}
              />
            </span>
            <span className="flex flex-wrap gap-2">
              {(role.permissions ?? []).slice(0, 5).map((permission) => (
                <Badge key={permission.id}>{permission.name}</Badge>
              ))}
              {(role.permissions?.length ?? 0) > 5 ? <Badge variant="blue">+{(role.permissions?.length ?? 0) - 5}</Badge> : null}
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}

function AuditPanel({
  user,
  department,
  manager,
}: {
  user: StaffUser;
  department?: Department;
  manager?: StaffUser;
}) {
  const rows = [
    { label: "Profile created", value: user.created_at ? dateTimeLabel(user.created_at) : "Not returned" },
    { label: "Profile updated", value: user.updated_at ? dateTimeLabel(user.updated_at) : "Not returned" },
    { label: "Department", value: department?.name ?? compactId(user.department_id) },
    { label: "Reporting manager", value: manager?.name ?? compactId(user.reports_to) },
    { label: "Duty status", value: user.is_on_duty ? "On duty" : "Off duty" },
    { label: "Account status", value: user.is_active ? "Active" : "Inactive" },
  ];

  return (
    <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold">Audit Log</h3>
      <div className="grid gap-2">
        {rows.map((row) => (
          <DetailRow key={row.label} label={row.label} value={row.value} />
        ))}
      </div>
    </section>
  );
}

interface StaffMetrics {
  assignedTickets: number;
  openTickets: number;
  closedTickets: number;
  escalatedTickets: number;
  avgResolutionLabel: string;
  attendancePercent: number;
  hoursThisMonth: string;
}

function buildStaffMetrics(
  user: StaffUser | undefined,
  tickets: Ticket[],
  shifts: EmployeeShift[],
): StaffMetrics {
  const openTickets = tickets.filter((ticket) => !isTicketClosed(ticket)).length;
  const closedTickets = tickets.length - openTickets;
  const presentShifts = shifts.filter((shift) => ["checked_in", "completed"].includes(shift.status)).length;
  const attendancePercent = shifts.length
    ? Math.round((presentShifts / shifts.length) * 100)
    : user?.is_on_duty
      ? 100
      : 0;
  const hours = shifts.reduce((sum, shift) => sum + numericShiftHours(shift), 0);

  return {
    assignedTickets: tickets.length,
    openTickets,
    closedTickets,
    escalatedTickets: tickets.filter(isTicketEscalated).length,
    avgResolutionLabel: averageResolutionLabel(tickets),
    attendancePercent,
    hoursThisMonth: `${Math.round(hours)}h`,
  };
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
        <Icon className="size-4 text-slate-500" />
      </div>
      <p className="mt-2 truncate text-2xl font-semibold">{value}</p>
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded bg-slate-50 px-3 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}

function TicketRow({ ticket }: { ticket: Ticket }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded bg-slate-50 px-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-semibold">{ticket.ticket_code}</p>
        <p className="truncate text-xs text-slate-500">{ticket.item_description}</p>
      </div>
      <Badge variant={stageVariant(ticket.stage)}>{titleCase(ticket.stage)}</Badge>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: number }) {
  if (priority >= 4) {
    return <Badge variant="rose">P{priority}</Badge>;
  }
  if (priority === 3) {
    return <Badge variant="amber">P{priority}</Badge>;
  }
  return <Badge variant="teal">P{priority}</Badge>;
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function isTicketClosed(ticket: Ticket) {
  return Boolean(ticket.resolved_at) || ["approved", "completed", "closed"].includes(ticket.stage.toLowerCase());
}

function isTicketEscalated(ticket: Ticket) {
  return ticket.priority >= 4 || ticket.stage.toLowerCase().includes("escalat");
}

function averageResolutionLabel(tickets: Ticket[]) {
  const resolvedDurations = tickets
    .filter((ticket) => ticket.resolved_at)
    .map((ticket) => Math.max(0, new Date(ticket.resolved_at as string).getTime() - new Date(ticket.created_at).getTime()));

  if (!resolvedDurations.length) {
    return "0m";
  }

  const averageMinutes = Math.round(resolvedDurations.reduce((sum, item) => sum + item, 0) / resolvedDurations.length / 60000);
  if (averageMinutes >= 60) {
    return `${Math.round(averageMinutes / 60)}h`;
  }
  return `${averageMinutes}m`;
}

function numericShiftHours(shift: EmployeeShift) {
  const start = shift.actual_start ? new Date(shift.actual_start) : shiftDateTime(shift.shift_date, shift.shift_start);
  const end = shift.actual_end ? new Date(shift.actual_end) : shiftDateTime(shift.shift_date, shift.shift_end);
  const diff = Math.max(0, end.getTime() - start.getTime());
  return diff / 3600000;
}

function shiftHours(shift: EmployeeShift) {
  return `${numericShiftHours(shift).toFixed(1)}h`;
}

function shiftDateTime(date: string, time: string) {
  return new Date(`${date}T${time}`);
}

function timeLabel(value: string | null | undefined) {
  if (!value) {
    return "None";
  }
  const normalized = value.includes("T") ? value : `2026-01-01T${value}`;
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date(normalized));
}

function dateLabel(value: string | null | undefined) {
  if (!value) {
    return "None";
  }
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function dateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isToday(value: string) {
  return new Date(value).toDateString() === new Date().toDateString();
}

function stageVariant(stage: string): "green" | "amber" | "blue" | "rose" | "default" {
  const normalized = stage.toLowerCase();
  if (["approved", "completed", "closed"].includes(normalized)) {
    return "green";
  }
  if (normalized.includes("pending")) {
    return "amber";
  }
  if (normalized.includes("accept")) {
    return "blue";
  }
  if (normalized.includes("escalat")) {
    return "rose";
  }
  return "default";
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

function normalizeStaffLevel(value: string | null | undefined) {
  if (value === "admin" || value === "manager" || value === "supervisor" || value === "attendant") {
    return value;
  }
  return "attendant";
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function buildActivity(user: StaffUser, tickets: Ticket[], shifts: EmployeeShift[]) {
  const events = [
    ...tickets.slice(0, 5).map((ticket) => ({
      time: timeLabel(ticket.updated_at),
      label: `${titleCase(ticket.stage)} ${ticket.ticket_code}`,
    })),
    ...shifts.slice(0, 5).map((shift) => ({
      time: timeLabel(shift.actual_start ?? shift.shift_start),
      label: `${titleCase(shift.status)} shift on ${dateLabel(shift.shift_date)}`,
    })),
  ];

  if (user.updated_at) {
    events.push({ time: timeLabel(user.updated_at), label: "Profile updated" });
  }

  if (!events.length) {
    return [{ time: "Now", label: "No recent activity" }];
  }

  return events.slice(0, 10);
}

function buildTicketTrend(tickets: Ticket[]) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      label: new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(date),
      value: 0,
    };
  });

  tickets.forEach((ticket) => {
    const key = ticket.created_at.slice(0, 10);
    const day = days.find((item) => item.key === key);
    if (day) {
      day.value += 1;
    }
  });

  return days;
}
