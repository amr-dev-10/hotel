"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, ConciergeBell, LogOut, ShoppingCart, Soup } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GuestChatWidget } from "@/features/guest-portal/components/guest-chat-widget";
import { cn } from "@/lib/utils";
import { useGuestCartStore } from "@/stores/guest-cart.store";
import { useGuestSessionStore } from "@/stores/guest-session.store";

const navItems = [
  { label: "Menu", href: "/guest/menu", icon: Soup },
  { label: "Cart", href: "/guest/cart", icon: ShoppingCart },
  { label: "Orders", href: "/guest/orders", icon: ClipboardList },
  { label: "Requests", href: "/guest/requests", icon: ConciergeBell },
];

export function GuestShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useGuestSessionStore((state) => state.profile);
  const clearSession = useGuestSessionStore((state) => state.clear);
  const cartCount = useGuestCartStore((state) => state.items.reduce((total, item) => total + item.quantity, 0));

  return (
    <div className="min-h-screen bg-[#f7f8f4] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col bg-white shadow-sm">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <Link className="min-w-0" href={profile ? "/guest/menu" : "/guest"}>
              <p className="text-xs font-semibold uppercase tracking-normal text-emerald-700">Arcadia Guest</p>
              <h1 className="truncate text-base font-semibold">
                {profile ? `${profile.guest.name} · Room ${profile.room_number ?? "Guest"}` : "Guest Portal"}
              </h1>
            </Link>
            {profile ? (
              <Button
                aria-label="Sign out"
                size="icon"
                type="button"
                variant="ghost"
                onClick={() => {
                  clearSession();
                  router.replace("/guest");
                }}
              >
                <LogOut />
              </Button>
            ) : null}
          </div>
        </header>

        <main className="flex-1 px-4 pb-24 pt-4">{children}</main>

        {profile ? (
          <>
            <GuestChatWidget />
            <nav className="fixed bottom-0 left-1/2 z-30 grid w-full max-w-3xl -translate-x-1/2 grid-cols-4 border-t border-slate-200 bg-white">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    className={cn(
                      "relative grid min-h-14 place-items-center gap-0.5 px-1 py-2 text-xs font-medium text-slate-500",
                      active && "text-[var(--primary)]",
                    )}
                    href={item.href}
                    key={item.href}
                  >
                    <Icon className="size-5" />
                    <span>{item.label}</span>
                    {item.href === "/guest/cart" && cartCount ? (
                      <span className="absolute right-5 top-1 rounded-full bg-emerald-600 px-1.5 text-[10px] font-semibold text-white">
                        {cartCount}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </>
        ) : null}
      </div>
    </div>
  );
}
