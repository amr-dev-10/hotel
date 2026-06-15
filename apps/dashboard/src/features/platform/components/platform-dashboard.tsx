"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, DoorOpen, Hotel, MessageSquareText, ShieldCheck, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { money } from "@/lib/utils";
import { platformGet } from "@/lib/api/platform-client";
import { usePlatformAuthStore } from "@/stores/platform-auth.store";
import type { PlatformDashboard as PlatformDashboardType, PlatformHotelSummary } from "@/types/domain";

export function PlatformDashboard() {
  const router = useRouter();
  const token = usePlatformAuthStore((state) => state.token);
  const adminName = usePlatformAuthStore((state) => state.adminName);
  const adminEmail = usePlatformAuthStore((state) => state.adminEmail);
  const logout = usePlatformAuthStore((state) => state.logout);

  const dashboard = useQuery({
    queryKey: ["platform", "dashboard"],
    queryFn: () => platformGet<PlatformDashboardType>("/platform/dashboard"),
    enabled: Boolean(token),
  });
  const hotels = useQuery({
    queryKey: ["platform", "hotels"],
    queryFn: () => platformGet<PlatformHotelSummary[]>("/platform/hotels"),
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (!token) {
      router.replace("/platform/login");
    }
  }, [router, token]);

  function handleLogout() {
    logout();
    router.replace("/platform/login");
  }

  if (!token) {
    return <DataState isLoading />;
  }

  if (dashboard.isLoading || hotels.isLoading) {
    return <DataState isLoading />;
  }

  if (dashboard.error || hotels.error) {
    return <DataState error={dashboard.error ?? hotels.error} />;
  }

  const metrics = dashboard.data;

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-slate-950 text-white">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-950">Arcadia Platform</h1>
              <p className="text-sm text-slate-500">{adminName ?? adminEmail ?? "Super Admin"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild type="button" variant="secondary">
              <Link href="/login">
                <Building2 />
                Hotel login
              </Link>
            </Button>
            <Button type="button" variant="ghost" onClick={handleLogout}>
              <DoorOpen />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:px-6">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricTile icon={<Hotel />} label="Total hotels" value={(metrics?.total_hotels ?? 0).toString()} />
          <MetricTile icon={<Hotel />} label="Active hotels" value={(metrics?.active_hotels ?? 0).toString()} />
          <MetricTile icon={<Building2 />} label="Rooms" value={(metrics?.total_rooms ?? 0).toString()} />
          <MetricTile icon={<UsersRound />} label="Users" value={(metrics?.total_users ?? 0).toString()} />
          <MetricTile icon={<MessageSquareText />} label="MRR" value={money(metrics?.mrr)} />
        </section>

        <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-semibold">Hotels</h2>
              <p className="text-sm text-slate-500">Cross-hotel platform inventory.</p>
            </div>
            <Badge variant="blue">{metrics?.whatsapp_usage.messages_sent ?? 0} WhatsApp sent</Badge>
          </div>

          {!hotels.data?.length ? (
            <DataState empty emptyTitle="No hotels found." />
          ) : (
            <div className="overflow-hidden rounded-md border border-slate-200">
              <div className="grid grid-cols-[1fr_120px_90px_90px_90px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
                <span>Hotel</span>
                <span>Status</span>
                <span>Plan</span>
                <span>Users</span>
                <span>Tickets</span>
              </div>
              {hotels.data.map((hotel) => (
                <div
                  className="grid grid-cols-[1fr_120px_90px_90px_90px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
                  key={hotel.id}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">{hotel.name}</p>
                    <p className="truncate text-xs text-slate-500">{hotel.slug}</p>
                  </div>
                  <Badge variant={hotel.status === "active" ? "green" : "amber"}>{hotel.status}</Badge>
                  <span className="truncate text-slate-700">{hotel.subscription_tier}</span>
                  <span className="text-slate-700">{hotel.active_users}</span>
                  <span className="text-slate-700">{hotel.open_tickets}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
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
