"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ExternalLink, Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Select } from "@/components/ui/select";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import {
  usePlatformHotels,
  usePlatformSubscriptions,
} from "@/features/platform/hooks/usePlatform";
import { titleCase } from "@/lib/utils";

const PLATFORM_PAGE_SIZE = 50;

export function PlatformHotelsPage() {
  return (
    <PlatformShell>
      <PlatformHotelsContent />
    </PlatformShell>
  );
}

function PlatformHotelsContent() {
  const hotels = usePlatformHotels();
  const subscriptions = usePlatformSubscriptions();
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const subscriptionByHotel = useMemo(() => {
    const byHotel = new Map<string, string>();
    for (const subscription of subscriptions.data ?? []) {
      byHotel.set(subscription.hotel_id, subscription.status);
    }
    return byHotel;
  }, [subscriptions.data]);

  const filteredHotels = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return (hotels.data ?? []).filter((hotel) => {
      const matchesPlan = plan === "all" || hotel.subscription_tier === plan;
      const matchesStatus = status === "all" || hotel.status === status;
      const matchesSearch =
        !normalizedSearch ||
        [hotel.name, hotel.slug, hotel.id]
          .some((value) => value.toLowerCase().includes(normalizedSearch));

      return matchesPlan && matchesStatus && matchesSearch;
    });
  }, [hotels.data, plan, search, status]);

  useEffect(() => {
    setPage(1);
  }, [plan, search, status]);

  const pageCount = Math.max(1, Math.ceil(filteredHotels.length / PLATFORM_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedHotels = useMemo(() => {
    const start = (currentPage - 1) * PLATFORM_PAGE_SIZE;
    return filteredHotels.slice(start, start + PLATFORM_PAGE_SIZE);
  }, [currentPage, filteredHotels]);

  if (hotels.isLoading || subscriptions.isLoading) {
    return <DataState isLoading />;
  }

  if (hotels.error || subscriptions.error) {
    return <DataState error={hotels.error ?? subscriptions.error} />;
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Hotels</h2>
          <p className="text-sm text-slate-500">Tenant inventory and operational load across the platform.</p>
        </div>
        <Button asChild type="button">
          <Link href="/platform/hotels/new">
            <Plus />
            Create hotel
          </Link>
        </Button>
      </div>

      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
          <label className="relative block">
            <span className="sr-only">Search hotels</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search by name, slug, or tenant ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label>
            <span className="sr-only">Plan</span>
            <Select value={plan} onChange={(event) => setPlan(event.target.value)}>
              <option value="all">All plans</option>
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </Select>
          </label>
          <label>
            <span className="sr-only">Status</span>
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="suspended">Suspended</option>
              <option value="inactive">Inactive</option>
            </Select>
          </label>
        </div>
      </section>

      {!filteredHotels.length ? (
        <DataState empty emptyTitle={hotels.data?.length ? "No hotels match these filters." : "No hotels found."} />
      ) : (
        <div className="grid gap-3">
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-normal text-slate-500">
                  <tr>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Hotel</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Plan</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Subscription</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Users</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Rooms</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Tickets</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Created</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {paginatedHotels.map((hotel) => (
                    <tr className="border-b border-slate-100 last:border-0" key={hotel.id}>
                      <td className="px-4 py-3 align-middle">
                        <div className="min-w-0">
                          <Link
                            className="font-semibold text-slate-950 hover:text-[#0F3D91]"
                            href={`/platform/hotels/${hotel.id}`}
                          >
                            {hotel.name}
                          </Link>
                          <p className="mt-0.5 text-xs text-slate-500">{hotel.slug}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <Badge variant={planVariant(hotel.subscription_tier)}>{titleCase(hotel.subscription_tier)}</Badge>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <Badge variant={subscriptionByHotel.get(hotel.id) === "active" ? "green" : "default"}>
                          {titleCase(subscriptionByHotel.get(hotel.id))}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-middle">{hotel.active_users}</td>
                      <td className="px-4 py-3 align-middle">{hotel.total_rooms}</td>
                      <td className="px-4 py-3 align-middle">{hotel.open_tickets}</td>
                      <td className="px-4 py-3 align-middle">{format(new Date(hotel.created_at), "dd MMM yyyy")}</td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm" type="button" variant="secondary">
                            <Link href={`/${hotel.id}/overview`}>
                              <ExternalLink />
                              Open
                            </Link>
                          </Button>
                          <Button asChild size="sm" type="button">
                            <Link href={`/platform/hotels/${hotel.id}`}>Inspect</Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <PaginationControls
            page={currentPage}
            pageSize={PLATFORM_PAGE_SIZE}
            totalItems={filteredHotels.length}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}

function planVariant(plan: string) {
  if (plan === "enterprise") {
    return "teal";
  }
  if (plan === "professional") {
    return "blue";
  }
  return "default";
}
