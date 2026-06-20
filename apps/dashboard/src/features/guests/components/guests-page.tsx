"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Mail, MessageCircle, Phone, Search, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Can } from "@/lib/auth/can";
import { compactId, titleCase } from "@/lib/utils";
import type { Guest } from "@/types/domain";
import { CreateGuestDialog } from "@/features/guests/components/create-guest-dialog";
import { useGuests } from "@/features/guests/hooks/useGuests";
import { useReservations } from "@/features/reservations/hooks/useReservations";
import { useWhatsappConversations } from "@/features/whatsapp/hooks/useWhatsapp";

export function GuestsPage({ hotelId }: { hotelId: string }) {
  const guests = useGuests(hotelId);
  const reservations = useReservations(hotelId);
  const conversations = useWhatsappConversations(hotelId);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const reservationCountByGuest = useMemo(() => {
    const counts = new Map<string, number>();
    for (const reservation of reservations.data ?? []) {
      counts.set(reservation.guest_id, (counts.get(reservation.guest_id) ?? 0) + 1);
    }
    return counts;
  }, [reservations.data]);

  const conversationByGuest = useMemo(() => {
    const byGuest = new Map<string, boolean>();
    for (const conversation of conversations.data ?? []) {
      if (conversation.guest_id) {
        byGuest.set(conversation.guest_id, true);
      }
    }
    return byGuest;
  }, [conversations.data]);

  const filteredGuests = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return (guests.data ?? []).filter((guest) => {
      const matchesStatus = status === "all" || guest.status === status;
      const matchesSearch =
        !normalizedSearch ||
        [
          guest.name,
          guest.phone,
          guest.whatsapp_phone,
          guest.email,
          guest.id,
        ]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalizedSearch));

      return matchesStatus && matchesSearch;
    });
  }, [guests.data, search, status]);

  if (guests.isLoading) {
    return <DataState isLoading />;
  }

  if (guests.error) {
    return <DataState error={guests.error} />;
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Guests</h2>
          <p className="text-sm text-slate-500">Profiles, stays, and communication history.</p>
        </div>
        <Can I="create" a="Guest">
          <CreateGuestDialog hotelId={hotelId} />
        </Can>
      </div>

      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
          <label className="relative block">
            <span className="sr-only">Search guests</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search by name, phone, email, or ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label>
            <span className="sr-only">Guest status</span>
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="checked_in">Checked in</option>
              <option value="reserved">Reserved</option>
              <option value="checked_out">Checked out</option>
              <option value="inactive">Inactive</option>
            </Select>
          </label>
        </div>
      </section>

      {!filteredGuests.length ? (
        <DataState empty emptyTitle={guests.data?.length ? "No guests match these filters." : "No guests yet."} />
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-normal text-slate-500">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Guest</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Contact</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Stay Window</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Reservations</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">Status</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {filteredGuests.map((guest) => (
                  <GuestRow
                    guest={guest}
                    hasConversation={conversationByGuest.get(guest.id) ?? false}
                    hotelId={hotelId}
                    key={guest.id}
                    reservationCount={reservationCountByGuest.get(guest.id) ?? 0}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function GuestRow({
  guest,
  hasConversation,
  hotelId,
  reservationCount,
}: {
  guest: Guest;
  hasConversation: boolean;
  hotelId: string;
  reservationCount: number;
}) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#0F3D91]/10 text-[#0F3D91]">
            <UserRound className="size-4" />
          </div>
          <div className="min-w-0">
            <Link
              className="truncate font-semibold text-slate-950 hover:text-[#0F3D91]"
              href={`/${hotelId}/guests/${guest.id}`}
            >
              {guest.name}
            </Link>
            <p className="text-xs text-slate-500">{compactId(guest.id)}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="grid gap-1 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <Phone className="size-3.5" />
            {guest.phone ?? "No phone"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MessageCircle className="size-3.5" />
            {guest.whatsapp_phone ?? "No WhatsApp"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Mail className="size-3.5" />
            {guest.email ?? "No email"}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 align-middle text-slate-600">
        {formatDate(guest.check_in_date)} to {formatDate(guest.check_out_date)}
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-2">
          <Badge variant={reservationCount > 1 ? "teal" : "default"}>{reservationCount}</Badge>
          {hasConversation ? <Badge variant="green">WhatsApp</Badge> : null}
        </div>
      </td>
      <td className="px-4 py-3 align-middle">
        <Badge variant={guestStatusVariant(guest.status)}>{titleCase(guest.status)}</Badge>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex justify-end">
          <Button asChild size="sm" type="button" variant="secondary">
            <Link href={`/${hotelId}/guests/${guest.id}`}>Profile</Link>
          </Button>
        </div>
      </td>
    </tr>
  );
}

function guestStatusVariant(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("checked_in") || normalized.includes("active")) {
    return "green";
  }
  if (normalized.includes("reserved")) {
    return "blue";
  }
  if (normalized.includes("checked_out")) {
    return "teal";
  }
  return "default";
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return format(new Date(value), "dd MMM yyyy");
}
