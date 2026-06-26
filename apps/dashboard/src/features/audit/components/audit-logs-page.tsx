"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { FileClock, RefreshCw, Search, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAuditLogs, type AuditLogFilters } from "@/features/audit/hooks/useAuditLogs";
import { useStaff } from "@/features/staff/hooks/useStaff";
import { cn, compactId, titleCase } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import type { AuditLog, CurrentUser, StaffUser } from "@/types/domain";

const DEFAULT_LIMIT = 100;
type BadgeVariant = "default" | "blue" | "teal" | "amber" | "rose" | "green";

export function AuditLogsPage({ hotelId }: { hotelId: string }) {
  const currentUser = useAuthStore((state) => state.currentUser);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [entity, setEntity] = useState("all");
  const [userId, setUserId] = useState("all");
  const [limit, setLimit] = useState(DEFAULT_LIMIT);

  const isAdmin = isHotelAdmin(currentUser);
  const filters = useMemo<AuditLogFilters>(
    () => ({
      search: search.trim() || undefined,
      action: action === "all" ? undefined : action,
      entity: entity === "all" ? undefined : entity,
      user_id: userId === "all" ? undefined : userId,
      limit,
    }),
    [action, entity, limit, search, userId],
  );
  const auditLogs = useAuditLogs(hotelId, filters, isAdmin);
  const staff = useStaff(isAdmin ? hotelId : "");

  const staffById = useMemo(() => {
    const map = new Map<string, StaffUser | CurrentUser>();
    for (const user of staff.data ?? []) {
      map.set(user.id, user);
    }
    if (currentUser) {
      map.set(currentUser.id, currentUser);
    }
    return map;
  }, [currentUser, staff.data]);

  const logs = useMemo(() => auditLogs.data ?? [], [auditLogs.data]);
  const actionOptions = uniqueValues(logs.map((log) => log.action));
  const entityOptions = uniqueValues(logs.map((log) => log.entity));

  const metrics = useMemo(() => {
    const actors = new Set(logs.map((log) => log.user_id).filter(Boolean));
    return {
      total: logs.length,
      actors: actors.size,
      updates: logs.filter((log) => Object.keys(log.old_payload ?? {}).length || Object.keys(log.new_payload ?? {}).length)
        .length,
    };
  }, [logs]);

  if (!currentUser) {
    return <DataState isLoading />;
  }

  if (!isAdmin) {
    return <DataState empty emptyTitle="Audit logs are available only to hotel admins." />;
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div>
          <h2 className="text-xl font-semibold">Audit Logs</h2>
          <p className="text-sm text-slate-500">Track admin, staff, reservation, ticket, guest, and system changes.</p>
        </div>
        <Button
          disabled={auditLogs.isFetching}
          type="button"
          variant="secondary"
          onClick={() => void auditLogs.refetch()}
        >
          <RefreshCw className={cn(auditLogs.isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <Metric label="Recent events" value={metrics.total} />
        <Metric label="Actors" value={metrics.actors} />
        <Metric label="Updates" value={metrics.updates} />
      </section>

      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_180px_220px_120px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search action, entity, record, user, IP"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <Select value={action} onChange={(event) => setAction(event.target.value)}>
            <option value="all">All actions</option>
            {actionOptions.map((option) => (
              <option key={option} value={option}>
                {titleCase(option)}
              </option>
            ))}
          </Select>
          <Select value={entity} onChange={(event) => setEntity(event.target.value)}>
            <option value="all">All entities</option>
            {entityOptions.map((option) => (
              <option key={option} value={option}>
                {titleCase(option)}
              </option>
            ))}
          </Select>
          <Select value={userId} onChange={(event) => setUserId(event.target.value)}>
            <option value="all">All users</option>
            {(staff.data ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
          <Select value={String(limit)} onChange={(event) => setLimit(Number(event.target.value))}>
            <option value="50">50 rows</option>
            <option value="100">100 rows</option>
            <option value="200">200 rows</option>
          </Select>
        </div>
      </section>

      {auditLogs.isLoading ? <DataState isLoading /> : null}
      {auditLogs.error ? <DataState error={auditLogs.error} /> : null}
      {!auditLogs.isLoading && !logs.length ? <DataState empty emptyTitle="No audit logs match these filters." /> : null}

      {logs.length ? <AuditLogTable logs={logs} staffById={staffById} /> : null}
    </div>
  );
}

function AuditLogTable({
  logs,
  staffById,
}: {
  logs: AuditLog[];
  staffById: Map<string, StaffUser | CurrentUser>;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <div className="grid min-w-[1100px] grid-cols-[170px_190px_170px_150px_170px_130px_1fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
          <span>Time</span>
          <span>Actor</span>
          <span>Action</span>
          <span>Entity</span>
          <span>Record</span>
          <span>IP address</span>
          <span>Changed fields</span>
        </div>
        {logs.map((log) => {
          const actor = log.user_id ? staffById.get(log.user_id) : null;

          return (
            <article
              className="grid min-w-[1100px] grid-cols-[170px_190px_170px_150px_170px_130px_1fr] items-start gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
              key={log.id}
            >
              <div>
                <p className="font-medium text-slate-900">{formatSafeDate(log.created_at, "dd MMM yyyy")}</p>
                <p className="text-xs text-slate-500">{formatSafeDate(log.created_at, "hh:mm a")}</p>
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{actor?.name ?? "System"}</p>
                <p className="truncate text-xs text-slate-500">{log.user_id ? compactId(log.user_id) : "No user"}</p>
              </div>
              <Badge variant={actionVariant(log.action)}>{titleCase(log.action)}</Badge>
              <div className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#0F3D91]/10 text-[#0F3D91]">
                  <FileClock className="size-4" />
                </span>
                <span className="truncate font-medium text-slate-800">{titleCase(log.entity)}</span>
              </div>
              <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{compactId(log.entity_id)}</code>
              <span className="text-xs text-slate-500">{log.ip_address ?? "Not captured"}</span>
              <ChangeSummary log={log} />
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ChangeSummary({ log }: { log: AuditLog }) {
  const changedKeys = changedFieldNames(log);
  const payloadKeys = Object.keys(log.payload ?? {});

  if (changedKeys.length) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {changedKeys.slice(0, 6).map((key) => (
          <Badge key={key} variant="blue">
            {titleCase(key)}
          </Badge>
        ))}
        {changedKeys.length > 6 ? <Badge>+{changedKeys.length - 6}</Badge> : null}
      </div>
    );
  }

  if (payloadKeys.length) {
    return <span className="text-xs text-slate-500">{payloadKeys.map(titleCase).join(", ")}</span>;
  }

  return <span className="text-xs text-slate-400">No payload</span>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex size-9 items-center justify-center rounded-md bg-[#0F3D91]/10 text-[#0F3D91]">
          <ShieldCheck className="size-4" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-normal text-slate-400">{label}</span>
      </div>
      <p className="mt-4 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function isHotelAdmin(user: CurrentUser | null) {
  return Boolean(
    user?.is_hotel_owner ||
      user?.user_type === "HOTEL_ADMIN" ||
      user?.staff_level?.toLowerCase() === "admin",
  );
}

function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function changedFieldNames(log: AuditLog) {
  return uniqueValues([...Object.keys(log.old_payload ?? {}), ...Object.keys(log.new_payload ?? {})]);
}

function formatSafeDate(value: string, pattern: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return format(parsed, pattern);
}

function actionVariant(action: string): BadgeVariant {
  if (action.includes("delete") || action.includes("cancel")) {
    return "rose";
  }
  if (action.includes("update") || action.includes("assign")) {
    return "amber";
  }
  if (action.includes("create") || action.includes("add")) {
    return "green";
  }
  return "default";
}
