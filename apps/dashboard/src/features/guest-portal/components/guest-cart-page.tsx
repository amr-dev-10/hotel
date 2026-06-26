"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, Send, Soup } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Textarea } from "@/components/ui/textarea";
import { usePlaceGuestOrder } from "@/features/guest-portal/hooks/useGuestPortal";
import { money } from "@/lib/utils";
import { useGuestCartStore } from "@/stores/guest-cart.store";
import { useGuestSessionStore } from "@/stores/guest-session.store";

export function GuestCartPage() {
  const router = useRouter();
  const token = useGuestSessionStore((state) => state.token);
  const items = useGuestCartStore((state) => state.items);
  const updateQuantity = useGuestCartStore((state) => state.updateQuantity);
  const updateNotes = useGuestCartStore((state) => state.updateNotes);
  const [instructions, setInstructions] = useState("");
  const placeOrder = usePlaceGuestOrder();
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);

  if (!token) {
    return <DataState empty emptyTitle="Please verify your stay before placing an order." />;
  }

  if (!items.length) {
    return (
      <div className="grid gap-4">
        <DataState empty emptyTitle="Your cart is empty." />
        <Button asChild variant="secondary">
          <Link href="/guest/menu">Browse menu</Link>
        </Button>
      </div>
    );
  }

  async function submitOrder() {
    await placeOrder.mutateAsync(
      {
        items: items.map((item) => ({
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
          notes: item.notes || null,
        })),
        special_instructions: instructions || null,
      },
      {
        onSuccess: () => {
          toast.success("Order sent to kitchen");
          router.push("/guest/orders");
        },
        onError: () => toast.error("Could not place order"),
      },
    );
  }

  return (
    <div className="grid gap-4">
      <section>
        <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Cart</p>
        <h2 className="mt-1 text-xl font-semibold">Review your order</h2>
      </section>

      <section className="grid gap-3">
        {items.map((item) => (
          <article className="rounded-md border border-slate-200 bg-white p-3" key={item.menu_item_id}>
            <div className="flex gap-3">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100">
                {item.image_url ? (
                  <img alt="" className="h-full w-full object-cover" src={item.image_url} />
                ) : (
                  <Soup className="size-6 text-slate-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{item.name}</h3>
                    <p className="text-xs text-slate-500">{money(item.price)} each</p>
                  </div>
                  <div className="flex h-8 items-center rounded-md border border-slate-200">
                    <button
                      aria-label="Decrease quantity"
                      className="grid size-8 place-items-center"
                      type="button"
                      onClick={() => updateQuantity(item.menu_item_id, item.quantity - 1)}
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      aria-label="Increase quantity"
                      className="grid size-8 place-items-center"
                      type="button"
                      onClick={() => updateQuantity(item.menu_item_id, item.quantity + 1)}
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
                <Textarea
                  className="mt-3 min-h-16"
                  placeholder="Item note"
                  value={item.notes}
                  onChange={(event) => updateNotes(item.menu_item_id, event.target.value)}
                />
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
        <Textarea
          placeholder="Delivery note or special instructions"
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
        />
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-sm text-slate-500">Estimated subtotal</span>
          <span className="text-lg font-semibold">{money(subtotal)}</span>
        </div>
        <Button disabled={placeOrder.isPending} type="button" onClick={submitOrder}>
          <Send />
          Place order
        </Button>
      </section>
    </div>
  );
}
