"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BedDouble, CalendarCheck, IndianRupee, ListChecks, MessageSquareText } from "lucide-react";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { DataState } from "@/components/ui/data-state";
import { money, percent } from "@/lib/utils";
import { useAnalytics } from "@/features/analytics/hooks/useAnalytics";
import { useHousekeeping } from "@/features/housekeeping/hooks/useHousekeeping";
import { useReservations } from "@/features/reservations/hooks/useReservations";
import { useRooms } from "@/features/rooms/hooks/useRooms";
import { useTickets } from "@/features/tickets/hooks/useTickets";

export function OverviewDashboard({ hotelId }: { hotelId: string }) {
  const analytics = useAnalytics(hotelId);
  const tickets = useTickets(hotelId, {});
  const reservations = useReservations(hotelId);
  const rooms = useRooms(hotelId);
  const housekeeping = useHousekeeping(hotelId);

  const latest = analytics.data?.at(-1);
  const openTickets = tickets.data?.filter((ticket) => !["approved", "Completed"].includes(ticket.stage)).length ?? 0;
  const arrivals =
    reservations.data?.filter((reservation) => reservation.status.toLowerCase().includes("book")).length ?? 0;
  const dirtyRooms = rooms.data?.filter((room) => ["dirty", "maintenance", "blocked"].includes(room.status)).length ?? 0;
  const pendingHousekeeping =
    housekeeping.data?.filter((task) => !["completed", "done"].includes(task.status)).length ?? 0;

  const chartData = useMemo(
    () =>
      (analytics.data ?? []).map((item) => ({
        date: item.snapshot_date.slice(5),
        occupancy: Math.round(item.occupancy_rate * 100),
        revenue: item.revenue_total,
        tickets: item.ticket_count,
        messages: item.whatsapp_messages,
      })),
    [analytics.data],
  );

  if (analytics.isLoading && !analytics.data) {
    return <DataState isLoading />;
  }

  if (analytics.error && !analytics.data) {
    return <DataState error={analytics.error} />;
  }

  return (
    <div className="grid gap-6">
      <PageBreadcrumbs
        current="Overview"
        description="Hotel performance, reservations, tickets, and operational signals."
        hotelId={hotelId}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricTile
          accent="blue"
          icon={<BedDouble />}
          label="Occupancy"
          value={percent(latest?.occupancy_rate)}
          helper={`${latest?.occupied_rooms ?? rooms.data?.filter((room) => room.status === "occupied").length ?? 0} of ${latest?.total_rooms ?? rooms.data?.length ?? 0} rooms`}
        />
        <MetricTile
          accent="amber"
          icon={<ListChecks />}
          label="Open tickets"
          value={openTickets.toString()}
          helper={`${tickets.data?.length ?? 0} total requests`}
        />
        <MetricTile
          accent="teal"
          icon={<CalendarCheck />}
          label="Upcoming arrivals"
          value={arrivals.toString()}
          helper={`${reservations.data?.length ?? 0} reservations loaded`}
        />
        <MetricTile
          accent="rose"
          icon={<BedDouble />}
          label="Rooms needing action"
          value={dirtyRooms.toString()}
          helper={`${pendingHousekeeping} housekeeping tasks`}
        />
        <MetricTile
          accent="green"
          icon={<IndianRupee />}
          label="Revenue"
          value={money(latest?.revenue_total)}
          helper={`${latest?.new_checkins ?? 0} check-ins today`}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[var(--shadow-control)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Occupancy and Revenue</h2>
              <p className="text-sm text-[var(--muted)]">Last 7 generated analytics snapshots</p>
            </div>
            <Badge variant="blue">Analytics</Badge>
          </div>
          {chartData.length ? (
            <div className="h-80">
              <ResponsiveContainer height="100%" width="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickLine={false} />
                  <YAxis tickLine={false} />
                  <Tooltip />
                  <Area
                    dataKey="occupancy"
                    fill="var(--primary)"
                    fillOpacity={0.16}
                    name="Occupancy %"
                    stroke="var(--primary)"
                    strokeWidth={2}
                  />
                  <Area
                    dataKey="revenue"
                    fill="var(--info)"
                    fillOpacity={0.1}
                    name="Revenue"
                    stroke="var(--info)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <DataState empty emptyTitle="Analytics snapshots will appear after backend data is available." />
          )}
        </div>

        <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[var(--shadow-control)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Workload Mix</h2>
              <p className="text-sm text-[var(--muted)]">Tickets and WhatsApp volume</p>
            </div>
            <MessageSquareText className="size-5 text-[var(--info)]" />
          </div>
          {chartData.length ? (
            <div className="h-80">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickLine={false} />
                  <YAxis tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="tickets" fill="var(--warning)" name="Tickets" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="messages" fill="var(--info)" name="Messages" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <DataState empty emptyTitle="No workload data for this range yet." />
          )}
        </div>
      </section>
    </div>
  );
}

function MetricTile({
  accent,
  icon,
  label,
  value,
  helper,
}: {
  accent: "blue" | "teal" | "amber" | "rose" | "green";
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  const accents = {
    blue: "bg-[var(--primary-soft)] text-[var(--primary)]",
    teal: "bg-[var(--info-soft)] text-[var(--info)]",
    amber: "bg-[var(--warning-soft)] text-[var(--warning)]",
    rose: "bg-[var(--destructive-soft)] text-[var(--destructive)]",
    green: "bg-[var(--success-soft)] text-[var(--success)]",
  };

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-control)] transition-colors hover:border-[var(--border-strong)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-[var(--muted)]">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{value}</p>
        </div>
        <div className={`flex size-9 items-center justify-center rounded-md ${accents[accent]} [&_svg]:size-4`}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">{helper}</p>
    </div>
  );
}
