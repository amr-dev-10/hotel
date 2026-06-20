"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Building2, ExternalLink, Hotel, Ticket, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import {
  usePlatformHotels,
  usePlatformSubscriptions,
  usePlatformUsers,
} from "@/features/platform/hooks/usePlatform";
import { compactId, titleCase } from "@/lib/utils";

export function PlatformHotelDetailPage({ hotelId }: { hotelId: string }) {
  return (
    <PlatformShell>
      <PlatformHotelDetailContent hotelId={hotelId} />
    </PlatformShell>
  );
}

function PlatformHotelDetailContent({ hotelId }: { hotelId: string }) {
  const hotels = usePlatformHotels();
  const users = usePlatformUsers();
  const subscriptions = usePlatformSubscriptions();

  if (hotels.isLoading || users.isLoading || subscriptions.isLoading) {
    return <DataState isLoading />;
  }

  if (hotels.error || users.error || subscriptions.error) {
    return <DataState error={hotels.error ?? users.error ?? subscriptions.error} />;
  }

  const hotel = hotels.data?.find((item) => item.id === hotelId);
  const hotelUsers = (users.data ?? []).filter((user) => user.hotel_id === hotelId);
  const subscription = subscriptions.data?.find((item) => item.hotel_id === hotelId);

  if (!hotel) {
    return <DataState empty emptyTitle="Hotel not found." />;
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Button asChild type="button" variant="ghost">
            <Link href="/platform/hotels">
              <ArrowLeft />
              Hotels
            </Link>
          </Button>
          <h2 className="mt-2 text-xl font-semibold">{hotel.name}</h2>
          <p className="text-sm text-slate-500">{hotel.slug}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={hotel.status === "active" ? "green" : "amber"}>{titleCase(hotel.status)}</Badge>
          <Button asChild type="button">
            <Link href={`/${hotel.id}/overview`}>
              <ExternalLink />
              Open hotel
            </Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 lg:grid-cols-4">
        <Detail icon={Hotel} label="Tenant ID" value={compactId(hotel.id)} />
        <Detail icon={Building2} label="Plan" value={titleCase(hotel.subscription_tier)} />
        <Detail icon={UsersRound} label="Active users" value={hotel.active_users.toString()} />
        <Detail icon={Ticket} label="Open tickets" value={hotel.open_tickets.toString()} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1fr]">
        <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold">Subscription</h3>
          {subscription ? (
            <div className="grid gap-3">
              <Metric label="Plan" value={titleCase(subscription.plan)} />
              <Metric label="Status" value={titleCase(subscription.status)} />
              <Metric label="Billing cycle" value={titleCase(subscription.billing_cycle)} />
              <Metric
                label="Renewal"
                value={subscription.renewal_date ? format(new Date(subscription.renewal_date), "dd MMM yyyy") : "Not set"}
              />
            </div>
          ) : (
            <DataState empty emptyTitle="No subscription row found." />
          )}
        </section>

        <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Users</h3>
              <p className="text-sm text-slate-500">Platform-wide user list filtered to this hotel.</p>
            </div>
            <Badge variant="blue">{hotelUsers.length}</Badge>
          </div>
          {!hotelUsers.length ? (
            <DataState empty emptyTitle="No users found for this hotel." />
          ) : (
            <div className="overflow-hidden rounded-md border border-slate-200">
              {hotelUsers.map((user) => (
                <div
                  className="grid gap-2 border-b border-slate-100 p-3 text-sm last:border-b-0 sm:grid-cols-[1fr_140px_90px]"
                  key={user.id}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">{user.name}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                  <span className="text-slate-600">{titleCase(user.staff_level ?? user.user_type)}</span>
                  <Badge variant={user.is_active ? "green" : "rose"}>{user.is_active ? "Active" : "Inactive"}</Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-slate-500">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-2 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
