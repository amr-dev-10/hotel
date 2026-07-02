"use client";

import Link from "next/link";
import { Building2, Hotel, MessageSquareText, Plus, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import {
  usePlatformDashboard,
  usePlatformHotels,
  usePlatformSubscriptions,
} from "@/features/platform/hooks/usePlatform";
import { money, titleCase } from "@/lib/utils";

export function PlatformStatsPage() {
  return (
    <PlatformShell>
      <PlatformStatsContent />
    </PlatformShell>
  );
}

function PlatformStatsContent() {
  const dashboard = usePlatformDashboard();
  const hotels = usePlatformHotels();
  const subscriptions = usePlatformSubscriptions();

  if (dashboard.isLoading || hotels.isLoading || subscriptions.isLoading) {
    return <DataState isLoading />;
  }

  if (dashboard.error || hotels.error || subscriptions.error) {
    return <DataState error={dashboard.error ?? hotels.error ?? subscriptions.error} />;
  }

  const metrics = dashboard.data;
  const activeRate =
    metrics?.total_hotels ? Math.round(((metrics.active_hotels ?? 0) / metrics.total_hotels) * 100) : 0;
  const openTickets = (hotels.data ?? []).reduce((sum, hotel) => sum + hotel.open_tickets, 0);
  const planCounts = (subscriptions.data ?? []).reduce<Record<string, number>>((counts, subscription) => {
    counts[subscription.plan] = (counts[subscription.plan] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Platform Stats</h2>
          <p className="text-sm text-slate-500">Cross-hotel tenant, usage, and subscription health.</p>
        </div>
        <Button asChild type="button">
          <Link href="/platform/hotels/new">
            <Plus />
            Create hotel
          </Link>
        </Button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricTile icon={<Hotel />} label="Total hotels" value={(metrics?.total_hotels ?? 0).toString()} />
        <MetricTile icon={<Hotel />} label="Active hotels" value={(metrics?.active_hotels ?? 0).toString()} />
        <MetricTile icon={<Building2 />} label="Rooms" value={(metrics?.total_rooms ?? 0).toString()} />
        <MetricTile icon={<UsersRound />} label="Users" value={(metrics?.total_users ?? 0).toString()} />
        <MetricTile icon={<MessageSquareText />} label="MRR" value={money(metrics?.mrr)} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-base font-semibold">Tenant Overview</h3>
              <p className="text-sm text-slate-500">Current hotel inventory ordered by recent creation.</p>
            </div>
            <Badge variant="blue">{activeRate}% active</Badge>
          </div>

          {!hotels.data?.length ? (
            <DataState empty emptyTitle="No hotels found." />
          ) : (
            <div className="overflow-hidden rounded-md border border-slate-200">
              <div className="grid min-w-[760px] grid-cols-[1fr_110px_120px_90px_90px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
                <span>Hotel</span>
                <span>Status</span>
                <span>Plan</span>
                <span>Users</span>
                <span>Tickets</span>
              </div>
              <div className="overflow-x-auto">
                {(hotels.data ?? []).slice(0, 8).map((hotel) => (
                  <Link
                    className="grid min-w-[760px] grid-cols-[1fr_110px_120px_90px_90px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-slate-50"
                    href={`/platform/hotels/${hotel.id}`}
                    key={hotel.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-950">{hotel.name}</p>
                      <p className="truncate text-xs text-slate-500">{hotel.slug}</p>
                    </div>
                    <Badge variant={hotel.status === "active" ? "green" : "amber"}>{titleCase(hotel.status)}</Badge>
                    <span className="truncate text-slate-700">{titleCase(hotel.subscription_tier)}</span>
                    <span className="text-slate-700">{hotel.active_users}</span>
                    <span className="text-slate-700">{hotel.open_tickets}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
          <div>
            <h3 className="text-base font-semibold">SaaS Signals</h3>
            <p className="text-sm text-slate-500">Plan mix and WhatsApp usage from confirmed backend totals.</p>
          </div>
          <div className="grid gap-3">
            <MetricRow label="Open tickets" value={openTickets.toString()} />
            <MetricRow
              label="WhatsApp sent"
              value={(metrics?.whatsapp_usage.messages_sent ?? 0).toString()}
            />
            <MetricRow
              label="WhatsApp received"
              value={(metrics?.whatsapp_usage.messages_received ?? 0).toString()}
            />
            <MetricRow label="Estimated WhatsApp cost" value={money(metrics?.whatsapp_usage.estimated_cost)} />
          </div>
          <div className="grid gap-2">
            {Object.entries(planCounts).map(([plan, count]) => (
              <div className="flex items-center justify-between rounded-md bg-slate-50 p-3" key={plan}>
                <span className="text-sm font-medium">{titleCase(plan)}</span>
                <Badge variant="teal">{count}</Badge>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
        <div className="flex size-9 items-center justify-center rounded-md bg-slate-100 text-slate-700 [&_svg]:size-4">
          {icon}
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-slate-50 p-3">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-950">{value}</span>
    </div>
  );
}
