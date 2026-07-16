"use client";

import { useMemo, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import {
  Activity,
  Briefcase,
  Mail,
  Network,
  Search,
  ShieldCheck,
  TicketCheck,
  UserRoundCheck,
  UserRoundX,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DataState } from "@/components/ui/data-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { absolutizeBackendUrl } from "@/lib/api/client";
import { titleCase } from "@/lib/utils";
import { useDepartments } from "@/features/departments/hooks/useDepartments";
import { useStaff } from "@/features/staff/hooks/useStaff";
import { useTickets } from "@/features/tickets/hooks/useTickets";
import type { StaffUser, Ticket } from "@/types/domain";

type GroupBy = "department" | "role" | "manager" | "shift" | "staff_level" | "status";

const ticketFilters = {};

export function StaffDirectory({ hotelId }: { hotelId: string }) {
  const staff = useStaff(hotelId);
  const departments = useDepartments(hotelId);
  const tickets = useTickets(hotelId, ticketFilters);
  const [query, setQuery] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [role, setRole] = useState("");
  const [level, setLevel] = useState("");
  const [status, setStatus] = useState("");
  const [shiftStatus, setShiftStatus] = useState("");
  const [ticketLoad, setTicketLoad] = useState("");
  const [rating, setRating] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("department");

  const departmentById = useMemo(
    () => new Map((departments.data ?? []).map((department) => [department.id, department.name])),
    [departments.data],
  );
  const staffById = useMemo(() => new Map((staff.data ?? []).map((user) => [user.id, user])), [staff.data]);
  const ticketsByUser = useMemo(() => groupTicketsByUser(tickets.data ?? []), [tickets.data]);
  const roleOptions = useMemo(
    () =>
      [...new Set((staff.data ?? []).map((user) => user.job_role).filter(Boolean) as string[])].sort((a, b) =>
        a.localeCompare(b),
      ),
    [staff.data],
  );

  const visibleStaff = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return (staff.data ?? []).filter((user) => {
      const manager = user.reports_to ? staffById.get(user.reports_to) : undefined;
      const departmentName = user.department_id ? departmentById.get(user.department_id) : undefined;
      const assignedTickets = ticketsByUser.get(user.id) ?? [];
      const workload = workloadBand(assignedTickets);
      const performance = performanceBand(assignedTickets);
      const searchText = [
        user.name,
        user.email,
        user.employee_code ?? "",
        user.job_role ?? "",
        user.staff_level ?? "",
        departmentName ?? "",
        manager?.name ?? "",
        user.id,
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!normalizedQuery || searchText.includes(normalizedQuery)) &&
        (!departmentId || user.department_id === departmentId) &&
        (!role || user.job_role === role) &&
        (!level || user.staff_level === level) &&
        (!status || (status === "active" ? user.is_active : !user.is_active)) &&
        (!shiftStatus || (shiftStatus === "on" ? user.is_on_duty : !user.is_on_duty)) &&
        (!ticketLoad || workload === ticketLoad) &&
        (!rating || performance === rating)
      );
    });
  }, [
    departmentById,
    departmentId,
    level,
    query,
    rating,
    role,
    shiftStatus,
    staff.data,
    staffById,
    status,
    ticketLoad,
    ticketsByUser,
  ]);

  const groupedStaff = useMemo(() => {
    const groups = new Map<string, StaffUser[]>();
    visibleStaff.forEach((user) => {
      const key = groupLabel(user, groupBy, departmentById, staffById);
      groups.set(key, [...(groups.get(key) ?? []), user]);
    });

    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [departmentById, groupBy, staffById, visibleStaff]);

  const summary = useMemo(() => {
    const active = (staff.data ?? []).filter((user) => user.is_active).length;
    const onDuty = (staff.data ?? []).filter((user) => user.is_on_duty).length;
    const openTickets = [...ticketsByUser.values()].flat().filter((ticket) => !isTicketClosed(ticket)).length;

    return {
      total: staff.data?.length ?? 0,
      active,
      onDuty,
      openTickets,
    };
  }, [staff.data, ticketsByUser]);

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
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard icon={Users} label="Total staff" value={summary.total} />
        <SummaryCard icon={UserRoundCheck} label="Active" value={summary.active} />
        <SummaryCard icon={Activity} label="On duty" value={summary.onDuty} />
        <SummaryCard icon={TicketCheck} label="Open workload" value={summary.openTickets} />
      </div>

      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
          <label className="relative block">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              aria-label="Search staff"
              className="pr-9"
              placeholder="Search name, email, code, role, manager"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <Select aria-label="Filter by department" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
            <option value="">All departments</option>
            {(departments.data ?? []).map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Filter by role" value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="">All roles</option>
            {roleOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Select aria-label="Filter by level" value={level} onChange={(event) => setLevel(event.target.value)}>
            <option value="">All levels</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="supervisor">Supervisor</option>
            <option value="attendant">Attendant</option>
          </Select>
          <Select aria-label="Group staff" value={groupBy} onChange={(event) => setGroupBy(event.target.value as GroupBy)}>
            <option value="department">Group by department</option>
            <option value="role">Group by role</option>
            <option value="manager">Group by manager</option>
            <option value="shift">Group by shift</option>
            <option value="staff_level">Group by level</option>
            <option value="status">Group by status</option>
          </Select>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Select aria-label="Filter by account status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Any account status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          <Select aria-label="Filter by shift status" value={shiftStatus} onChange={(event) => setShiftStatus(event.target.value)}>
            <option value="">Any duty status</option>
            <option value="on">On duty</option>
            <option value="off">Off duty</option>
          </Select>
          <Select aria-label="Filter by ticket load" value={ticketLoad} onChange={(event) => setTicketLoad(event.target.value)}>
            <option value="">Any ticket load</option>
            <option value="none">No tickets</option>
            <option value="light">Light load</option>
            <option value="steady">Steady load</option>
            <option value="heavy">Heavy load</option>
          </Select>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Select aria-label="Filter by performance signal" value={rating} onChange={(event) => setRating(event.target.value)}>
            <option value="">Any performance signal</option>
            <option value="strong">Strong</option>
            <option value="balanced">Balanced</option>
            <option value="watch">Watch</option>
          </Select>
          <div className="flex items-center justify-end text-sm text-slate-500">
            {visibleStaff.length} of {staff.data.length} shown
          </div>
        </div>
      </section>

      {!visibleStaff.length ? <DataState empty emptyTitle="No staff match these filters." /> : null}

      <div className="grid gap-5">
        {groupedStaff.map(([label, users]) => (
          <section className="grid gap-3" key={label}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Network className="size-4 text-slate-500" />
                <h3 className="text-sm font-semibold">{label}</h3>
              </div>
              <Badge>{users.length}</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {users.map((user) => (
                <StaffCard
                  departmentName={user.department_id ? departmentById.get(user.department_id) : undefined}
                  hotelId={hotelId}
                  key={user.id}
                  managerName={user.reports_to ? staffById.get(user.reports_to)?.name : undefined}
                  tickets={ticketsByUser.get(user.id) ?? []}
                  user={user}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function StaffCard({
  hotelId,
  user,
  departmentName,
  managerName,
  tickets,
}: {
  hotelId: string;
  user: StaffUser;
  departmentName?: string;
  managerName?: string;
  tickets: Ticket[];
}) {
  const openTickets = tickets.filter((ticket) => !isTicketClosed(ticket)).length;
  const closedTickets = tickets.length - openTickets;

  return (
    <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <StaffAvatar user={user} />
          <div className="min-w-0">
            <Link href={`/${hotelId}/settings/staff/${user.id}`} className="hover:text-[var(--primary)]" prefetch={false}>
              <h2 className="truncate text-base font-semibold">{user.name}</h2>
            </Link>
            <p className="mt-1 flex items-center gap-2 truncate text-sm text-slate-500">
              <Mail className="size-4" />
              {user.email}
            </p>
          </div>
        </div>
        <Badge variant={user.is_on_duty ? "green" : "default"}>
          {user.is_on_duty ? "On duty" : "Off duty"}
        </Badge>
      </div>

      <div className="mt-4 grid gap-2 text-sm">
        <DetailRow label="Employee code" value={employeeCode(user)} />
        <DetailRow label="Role" value={user.job_role ?? "Staff"} />
        <DetailRow label="Level" value={titleCase(user.staff_level)} />
        <DetailRow label="Department" value={departmentName ?? "Unassigned"} />
        <DetailRow label="Reports to" value={managerName ?? "No manager"} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniMetric label="Open" value={openTickets} />
        <MiniMetric label="Closed" value={closedTickets} />
        <MiniMetric label="Signal" value={titleCase(performanceBand(tickets))} />
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
        <Badge variant={workloadVariant(workloadBand(tickets))}>
          <Briefcase className="mr-1 size-3" />
          {titleCase(workloadBand(tickets))}
        </Badge>
      </div>
    </article>
  );
}

function StaffAvatar({ user }: { user: StaffUser }) {
  const imageUrl = absolutizeBackendUrl(user.profile_image_url);
  return (
    <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--primary)] text-sm font-semibold text-white">
      {imageUrl ? <img alt="" className="h-full w-full object-cover" src={imageUrl} /> : initials(user.name)}
    </span>
  );
}

function employeeCode(user: StaffUser) {
  return user.employee_code || "Not assigned";
}

function SummaryCard({
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
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
        <Icon className="size-4 text-slate-500" />
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded bg-slate-50 px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function groupTicketsByUser(tickets: Ticket[]) {
  const grouped = new Map<string, Ticket[]>();
  tickets.forEach((ticket) => {
    if (!ticket.assigned_to) {
      return;
    }
    grouped.set(ticket.assigned_to, [...(grouped.get(ticket.assigned_to) ?? []), ticket]);
  });
  return grouped;
}

function groupLabel(
  user: StaffUser,
  groupBy: GroupBy,
  departments: Map<string, string>,
  staffById: Map<string, StaffUser>,
) {
  if (groupBy === "department") {
    return user.department_id ? departments.get(user.department_id) ?? "Unassigned" : "Unassigned";
  }
  if (groupBy === "role") {
    return user.job_role ?? "Staff";
  }
  if (groupBy === "manager") {
    return user.reports_to ? staffById.get(user.reports_to)?.name ?? "No manager" : "No manager";
  }
  if (groupBy === "shift") {
    return user.is_on_duty ? "On duty" : "Off duty";
  }
  if (groupBy === "staff_level") {
    return titleCase(user.staff_level);
  }
  return user.is_active ? "Active" : "Inactive";
}

function isTicketClosed(ticket: Ticket) {
  return Boolean(ticket.resolved_at) || ["approved", "completed", "closed"].includes(ticket.stage.toLowerCase());
}

function workloadBand(tickets: Ticket[]) {
  const open = tickets.filter((ticket) => !isTicketClosed(ticket)).length;
  if (open === 0) {
    return "none";
  }
  if (open <= 2) {
    return "light";
  }
  if (open <= 5) {
    return "steady";
  }
  return "heavy";
}

function workloadVariant(load: string): "rose" | "amber" | "blue" | "default" {
  if (load === "heavy") {
    return "rose";
  }
  if (load === "steady") {
    return "amber";
  }
  if (load === "light") {
    return "blue";
  }
  return "default";
}

function performanceBand(tickets: Ticket[]) {
  const open = tickets.filter((ticket) => !isTicketClosed(ticket)).length;
  const closed = tickets.length - open;
  if (open >= 6) {
    return "watch";
  }
  if (closed >= 4 && closed >= open) {
    return "strong";
  }
  return "balanced";
}
