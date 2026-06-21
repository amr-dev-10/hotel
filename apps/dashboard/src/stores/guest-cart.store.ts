"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface GuestCartItem {
  menu_item_id: string;
  name: string;
  price: number;
  image_url: string | null;
  quantity: number;
  notes: string;
}

interface GuestCartState {
  items: GuestCartItem[];
  addItem: (item: Omit<GuestCartItem, "quantity" | "notes">) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  updateNotes: (menuItemId: string, notes: string) => void;
  removeItem: (menuItemId: string) => void;
  clear: () => void;
}

export const useGuestCartStore = create<GuestCartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((cartItem) => cartItem.menu_item_id === item.menu_item_id);
          if (existing) {
            return {
              items: state.items.map((cartItem) =>
                cartItem.menu_item_id === item.menu_item_id
                  ? { ...cartItem, quantity: cartItem.quantity + 1 }
                  : cartItem,
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity: 1, notes: "" }] };
        }),
      updateQuantity: (menuItemId, quantity) =>
        set((state) => ({
          items: state.items
            .map((item) => (item.menu_item_id === menuItemId ? { ...item, quantity } : item))
            .filter((item) => item.quantity > 0),
        })),
      updateNotes: (menuItemId, notes) =>
        set((state) => ({
          items: state.items.map((item) => (item.menu_item_id === menuItemId ? { ...item, notes } : item)),
        })),
      removeItem: (menuItemId) =>
        set((state) => ({ items: state.items.filter((item) => item.menu_item_id !== menuItemId) })),
      clear: () => set({ items: [] }),
    }),
    { name: "arcadia-guest-cart" },
  ),
);
