"use client";

import { useEffect, useMemo } from "react";
import { BellRing, Clock, CookingPot, PackageCheck, ReceiptText } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { useRestaurantOrders, useUpdateOrderStatus } from "@/features/fnb/hooks/useFnb";
import { useRooms } from "@/features/rooms/hooks/useRooms";
import { queryKeys } from "@/lib/api/query-keys";
import { money, titleCase } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import type { RestaurantOrder } from "@/types/domain";

const columns = [
  { key: "received", label: "Incoming", icon: BellRing },
  { key: "preparing", label: "Preparing", icon: CookingPot },
  { key: "ready", label: "Ready", icon: PackageCheck },
  { key: "delivered", label: "Delivered", icon: ReceiptText },
] as const;

export function KitchenPage({ hotelId }: { hotelId: string }) {
  const orders = useRestaurantOrders(hotelId);
  const updateStatus = useUpdateOrderStatus(hotelId);
  const rooms = useRooms(hotelId);
  useKitchenSocket(hotelId);
  const roomMap = useMemo(() => new Map((rooms.data ?? []).map((room) => [room.id, room.room_number])), [rooms.data]);

  const grouped = useMemo(() => {
    const map = new Map<string, RestaurantOrder[]>();
    for (const column of columns) {
      map.set(column.key, []);
    }
    for (const order of orders.data ?? []) {
      const key = normalizeStatus(order.status);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(order);
    }
    return map;
  }, [orders.data]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <PageBreadcrumbs
          current="Kitchen Operations"
          description="Move orders from incoming to delivered as the kitchen works."
          hotelId={hotelId}
        />
        <Badge variant="green">Live kitchen queue</Badge>
      </div>

      {orders.isLoading ? <DataState isLoading /> : null}
      {orders.error ? <DataState error={orders.error} /> : null}

      <section className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => {
          const Icon = column.icon;
          const rows = grouped.get(column.key) ?? [];
          return (
            <div className="grid content-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3" key={column.key}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className="size-4 text-[var(--primary)]" />
                  {column.label}
                </h3>
                <Badge>{rows.length}</Badge>
              </div>
              {rows.length ? (
                rows.map((order) => (
                  <KitchenOrderCard
                    key={order.id}
                    order={order}
                    roomLabel={order.room_id ? `Room ${roomMap.get(order.room_id) ?? "assigned"}` : "Table/POS"}
                    onMove={(status) => updateStatus.mutate({ orderId: order.id, status })}
                  />
                ))
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
                  No orders
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function KitchenOrderCard({ order, roomLabel, onMove }: { order: RestaurantOrder; roomLabel: string; onMove: (status: string) => void }) {
  const nextStatus = nextKitchenStatus(order.status);
  return (
    <article className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">{order.order_number}</h4>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            <Clock className="size-3" />
            {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <Badge variant={order.ordered_by_guest ? "green" : "default"}>{order.ordered_by_guest ? "Guest" : titleCase(order.source)}</Badge>
      </div>
      <div className="grid gap-1 text-xs text-slate-500">
        <span>Total: <strong className="text-slate-800">{money(order.total)}</strong></span>
        <span>Room: <strong className="text-slate-800">{roomLabel}</strong></span>
      </div>
      {order.special_instructions ? (
        <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">{order.special_instructions}</p>
      ) : null}
      {nextStatus ? (
        <Button size="sm" type="button" onClick={() => onMove(nextStatus)}>
          Move to {titleCase(nextStatus)}
        </Button>
      ) : (
        <Badge variant="green">Complete</Badge>
      )}
    </article>
  );
}

function useKitchenSocket(hotelId: string) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token || !hotelId) {
      return undefined;
    }
    const wsBase = process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8000";
    const socket = new WebSocket(`${wsBase}/ws/orders?token=${encodeURIComponent(token)}`);
    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as { event?: string; order_number?: string };
        if (event.event === "restaurant.order.created") {
          toast.success("New kitchen order", { description: event.order_number });
        }
      } catch {
        // Keep the kitchen queue fresh even if a custom event cannot be parsed.
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.fnb.orders(hotelId) });
    };
    return () => socket.close();
  }, [hotelId, queryClient, token]);
}

function normalizeStatus(status: string) {
  if (status === "pending") return "received";
  if (["served", "billed"].includes(status)) return "delivered";
  return status;
}

function nextKitchenStatus(status: string) {
  const normalized = normalizeStatus(status);
  if (normalized === "received") return "preparing";
  if (normalized === "preparing") return "ready";
  if (normalized === "ready") return "delivered";
  return null;
}
