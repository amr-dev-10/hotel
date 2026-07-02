"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Minus, Plus, ShoppingCart, Soup } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { useGuestMenuCategories, useGuestMenuItems, useGuestProfile } from "@/features/guest-portal/hooks/useGuestPortal";
import { cn, money } from "@/lib/utils";
import { useGuestCartStore } from "@/stores/guest-cart.store";
import { useGuestSessionStore } from "@/stores/guest-session.store";
import type { MenuItem } from "@/types/domain";

export function GuestMenuPage() {
  const token = useGuestSessionStore((state) => state.token);
  useGuestProfile();
  const categories = useGuestMenuCategories();
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const items = useGuestMenuItems(categoryId);
  const cartItems = useGuestCartStore((state) => state.items);
  const cartTotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);

  const activeCategory = useMemo(
    () => categories.data?.find((category) => category.id === categoryId),
    [categories.data, categoryId],
  );

  if (!token) {
    return <DataState empty emptyTitle="Please verify your stay to view the menu." />;
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-md border border-emerald-100 bg-emerald-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Food & Beverage</p>
        <h2 className="mt-1 text-xl font-semibold">What would you like today?</h2>
        <p className="mt-1 text-sm text-emerald-900/70">Freshly prepared and delivered through hotel service.</p>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <CategoryButton active={!categoryId} label="All" onClick={() => setCategoryId(undefined)} />
        {(categories.data ?? []).map((category) => (
          <CategoryButton
            active={category.id === categoryId}
            label={category.name}
            key={category.id}
            onClick={() => setCategoryId(category.id)}
          />
        ))}
      </div>

      {items.isLoading ? <DataState isLoading /> : null}
      {items.error ? <DataState error={items.error} /> : null}
      {!items.isLoading && !items.data?.length ? (
        <DataState empty emptyTitle={`No items${activeCategory ? ` in ${activeCategory.name}` : ""}.`} />
      ) : null}

      <section className="grid gap-3">
        {(items.data ?? []).map((item) => (
          <MenuCard item={item} key={item.id} />
        ))}
      </section>

      {cartItems.length ? (
        <Link
          className="fixed bottom-16 left-1/2 z-30 flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 items-center justify-between rounded-md bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white shadow-lg"
          href="/guest/cart"
        >
          <span className="flex items-center gap-2">
            <ShoppingCart className="size-4" />
            {cartItems.length} item{cartItems.length === 1 ? "" : "s"}
          </span>
          <span>{money(cartTotal)}</span>
        </Link>
      ) : null}
    </div>
  );
}

function CategoryButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <Button
      className={cn("shrink-0", active && "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]")}
      type="button"
      variant="secondary"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function MenuCard({ item }: { item: MenuItem }) {
  const addItem = useGuestCartStore((state) => state.addItem);
  const cartItem = useGuestCartStore((state) => state.items.find((entry) => entry.menu_item_id === item.id));
  const updateQuantity = useGuestCartStore((state) => state.updateQuantity);
  const price = Number(item.price ?? 0);

  return (
    <article className="grid grid-cols-[96px_1fr] gap-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-md bg-slate-100">
        {item.image_url ? (
          <img alt="" className="h-full w-full object-cover" src={item.image_url} />
        ) : (
          <Soup className="size-8 text-slate-400" />
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{item.name}</h3>
            <p className="mt-0.5 text-sm font-semibold text-emerald-700">{money(price)}</p>
          </div>
          {cartItem ? (
            <div className="flex h-8 items-center rounded-md border border-slate-200">
              <button
                aria-label="Decrease quantity"
                className="grid size-8 place-items-center"
                type="button"
                onClick={() => updateQuantity(item.id, cartItem.quantity - 1)}
              >
                <Minus className="size-4" />
              </button>
              <span className="w-6 text-center text-sm font-semibold">{cartItem.quantity}</span>
              <button
                aria-label="Increase quantity"
                className="grid size-8 place-items-center"
                type="button"
                onClick={() => updateQuantity(item.id, cartItem.quantity + 1)}
              >
                <Plus className="size-4" />
              </button>
            </div>
          ) : (
            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => {
                addItem({ menu_item_id: item.id, name: item.name, price, image_url: item.image_url });
                toast.success("Added to cart");
              }}
            >
              Add
            </Button>
          )}
        </div>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
          {item.description_short || item.description || "Chef recommended."}
        </p>
        {item.dietary_tags.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.dietary_tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="green">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
