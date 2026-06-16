"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { CreditCard, Edit3, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import {
  usePlatformHotels,
  usePlatformSubscriptions,
  useUpdatePlatformSubscription,
  type PlatformSubscriptionUpdatePayload,
} from "@/features/platform/hooks/usePlatform";
import { apiErrorMessage } from "@/lib/api/client";
import { compactId, titleCase } from "@/lib/utils";
import type { PlatformSubscriptionSummary } from "@/types/domain";

interface SubscriptionFormState {
  plan: string;
  status: string;
  billing_cycle: string;
  renewal_date: string;
}

export function PlatformSubscriptionsPage() {
  return (
    <PlatformShell>
      <PlatformSubscriptionsContent />
    </PlatformShell>
  );
}

function PlatformSubscriptionsContent() {
  const subscriptions = usePlatformSubscriptions();
  const hotels = usePlatformHotels();
  const updateSubscription = useUpdatePlatformSubscription();
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingSubscription, setEditingSubscription] = useState<PlatformSubscriptionSummary | null>(null);
  const [form, setForm] = useState<SubscriptionFormState>(() => emptyForm());

  const hotelById = useMemo(() => {
    const byId = new Map<string, string>();
    for (const hotel of hotels.data ?? []) {
      byId.set(hotel.id, hotel.name);
    }
    return byId;
  }, [hotels.data]);

  const filteredSubscriptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return (subscriptions.data ?? []).filter((subscription) => {
      const hotelName = hotelById.get(subscription.hotel_id) ?? "";
      const matchesPlan = planFilter === "all" || subscription.plan === planFilter;
      const matchesStatus = statusFilter === "all" || subscription.status === statusFilter;
      const matchesSearch =
        !normalizedSearch ||
        [subscription.plan, subscription.status, subscription.billing_cycle, subscription.hotel_id, hotelName]
          .some((value) => value.toLowerCase().includes(normalizedSearch));

      return matchesPlan && matchesStatus && matchesSearch;
    });
  }, [hotelById, planFilter, search, statusFilter, subscriptions.data]);

  function openEditor(subscription: PlatformSubscriptionSummary) {
    setEditingSubscription(subscription);
    setForm({
      plan: subscription.plan,
      status: subscription.status,
      billing_cycle: subscription.billing_cycle,
      renewal_date: subscription.renewal_date ?? "",
    });
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingSubscription) {
      return;
    }

    const payload: PlatformSubscriptionUpdatePayload = {
      plan: form.plan,
      status: form.status,
      billing_cycle: form.billing_cycle,
      renewal_date: form.renewal_date || null,
      cancelled_at:
        form.status === "cancelled"
          ? editingSubscription.cancelled_at ?? new Date().toISOString()
          : null,
    };

    try {
      await updateSubscription.mutateAsync({
        subscriptionId: editingSubscription.id,
        payload,
      });
      toast.success("Subscription updated");
      setEditingSubscription(null);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  if (subscriptions.isLoading || hotels.isLoading) {
    return <DataState isLoading />;
  }

  if (subscriptions.error || hotels.error) {
    return <DataState error={subscriptions.error ?? hotels.error} />;
  }

  return (
    <div className="grid gap-5">
      <div>
        <h2 className="text-xl font-semibold">Subscriptions</h2>
        <p className="text-sm text-slate-500">Update tenant plans, billing cycles, and subscription status.</p>
      </div>

      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
          <label className="relative block">
            <span className="sr-only">Search subscriptions</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search by hotel, plan, or status"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label>
            <span className="sr-only">Plan</span>
            <Select value={planFilter} onChange={(event) => setPlanFilter(event.target.value)}>
              <option value="all">All plans</option>
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </Select>
          </label>
          <label>
            <span className="sr-only">Status</span>
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="past_due">Past due</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </label>
        </div>
      </section>

      {!filteredSubscriptions.length ? (
        <DataState
          empty
          emptyTitle={subscriptions.data?.length ? "No subscriptions match these filters." : "No subscriptions found."}
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-normal text-slate-500">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Hotel</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Plan</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Status</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Billing</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Renewal</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Created</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {filteredSubscriptions.map((subscription) => (
                  <tr className="border-b border-slate-100 last:border-0" key={subscription.id}>
                    <td className="px-4 py-3 align-middle">
                      <Link className="font-semibold hover:text-[#0F3D91]" href={`/platform/hotels/${subscription.hotel_id}`}>
                        {hotelById.get(subscription.hotel_id) ?? compactId(subscription.hotel_id)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <Badge variant={planVariant(subscription.plan)}>{titleCase(subscription.plan)}</Badge>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <Badge variant={statusVariant(subscription.status)}>{titleCase(subscription.status)}</Badge>
                    </td>
                    <td className="px-4 py-3 align-middle">{titleCase(subscription.billing_cycle)}</td>
                    <td className="px-4 py-3 align-middle">
                      {subscription.renewal_date ? format(new Date(subscription.renewal_date), "dd MMM yyyy") : "Not set"}
                    </td>
                    <td className="px-4 py-3 align-middle">{format(new Date(subscription.created_at), "dd MMM yyyy")}</td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex justify-end">
                        <Button size="sm" type="button" variant="secondary" onClick={() => openEditor(subscription)}>
                          <Edit3 />
                          Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={Boolean(editingSubscription)} onOpenChange={(open) => !open && setEditingSubscription(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Subscription</DialogTitle>
            <DialogDescription>Plan changes also update the hotel plan shown in platform tenant views.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleSave}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Plan" id="platform-subscription-plan">
                <Select
                  id="platform-subscription-plan"
                  value={form.plan}
                  onChange={(event) => setForm((current) => ({ ...current, plan: event.target.value }))}
                >
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </Select>
              </Field>
              <Field label="Status" id="platform-subscription-status">
                <Select
                  id="platform-subscription-status"
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                >
                  <option value="active">Active</option>
                  <option value="trialing">Trialing</option>
                  <option value="past_due">Past due</option>
                  <option value="cancelled">Cancelled</option>
                </Select>
              </Field>
              <Field label="Billing cycle" id="platform-subscription-billing-cycle">
                <Select
                  id="platform-subscription-billing-cycle"
                  value={form.billing_cycle}
                  onChange={(event) => setForm((current) => ({ ...current, billing_cycle: event.target.value }))}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </Select>
              </Field>
              <Field label="Renewal date" id="platform-subscription-renewal">
                <Input
                  id="platform-subscription-renewal"
                  type="date"
                  value={form.renewal_date}
                  onChange={(event) => setForm((current) => ({ ...current, renewal_date: event.target.value }))}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditingSubscription(null)}>
                Close
              </Button>
              <Button disabled={updateSubscription.isPending} type="submit">
                <CreditCard />
                Save subscription
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function emptyForm(): SubscriptionFormState {
  return {
    plan: "starter",
    status: "active",
    billing_cycle: "monthly",
    renewal_date: "",
  };
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
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

function statusVariant(status: string) {
  if (status === "active" || status === "trialing") {
    return "green";
  }
  if (status === "cancelled") {
    return "rose";
  }
  if (status === "past_due") {
    return "amber";
  }
  return "default";
}
