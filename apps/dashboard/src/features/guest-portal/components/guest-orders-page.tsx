"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { DataState } from "@/components/ui/data-state";
import { useGuestOrders, useGuestProfile } from "@/features/guest-portal/hooks/useGuestPortal";
import { cn, money, titleCase } from "@/lib/utils";
import { useGuestSessionStore } from "@/stores/guest-session.store";
import type { RestaurantOrder } from "@/types/domain";

const steps = ["received", "preparing", "ready", "delivered"];

export function GuestOrdersPage() {
  const token = useGuestSessionStore((state) => state.token);
  useGuestProfile();
  const orders = useGuestOrders();

  if (!token) {
    return <DataState empty emptyTitle="Please verify your stay to track orders." />;
  }

  return (
    <div className="grid gap-4">
      <section>
        <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Orders</p>
        <h2 className="mt-1 text-xl font-semibold">Kitchen tracking</h2>
      </section>

      {orders.isLoading ? <DataState isLoading /> : null}
      {orders.error ? <DataState error={orders.error} /> : null}
      {!orders.isLoading && !orders.data?.length ? <DataState empty emptyTitle="No food orders yet." /> : null}

      <section className="grid gap-3">
        {(orders.data ?? []).map((order) => (
          <OrderCard order={order} key={order.id} />
        ))}
      </section>
    </div>
  );
}

function OrderCard({ order }: { order: RestaurantOrder }) {
  const activeIndex = Math.max(0, steps.indexOf(normalizeStatus(order.status)));
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{order.order_number}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {formatDistanceToNowStrict(new Date(order.created_at), { addSuffix: true })}
          </p>
        </div>
        <div className="text-right">
          <Badge variant={statusVariant(order.status)}>{titleCase(order.status)}</Badge>
          <p className="mt-1 text-sm font-semibold">{money(order.total)}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {steps.map((step, index) => {
          const done = index <= activeIndex;
          return (
            <div className="grid gap-1" key={step}>
              <span
                className={cn(
                  "h-1 rounded-full",
                  done ? "bg-emerald-600" : "bg-slate-200",
                )}
              />
              <span className={cn("text-[11px] font-medium", done ? "text-emerald-700" : "text-slate-400")}>
                {titleCase(step)}
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function normalizeStatus(status: string) {
  if (["served", "billed"].includes(status)) {
    return "delivered";
  }
  if (status === "pending") {
    return "received";
  }
  return status;
}

function statusVariant(status: string) {
  const normalized = normalizeStatus(status);
  if (normalized === "delivered") return "green";
  if (normalized === "ready") return "blue";
  if (normalized === "preparing") return "amber";
  return "default";
}
