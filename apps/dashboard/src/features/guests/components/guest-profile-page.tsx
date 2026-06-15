"use client";

import { useMemo } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  CalendarDays,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { compactId, titleCase } from "@/lib/utils";
import type { Reservation, WhatsAppConversation } from "@/types/domain";
import { useGuest, useGuestConsent } from "@/features/guests/hooks/useGuests";
import { useReservations } from "@/features/reservations/hooks/useReservations";
import {
  useWhatsappConversations,
  useWhatsappMessages,
} from "@/features/whatsapp/hooks/useWhatsapp";

export function GuestProfilePage({
  hotelId,
  guestId,
}: {
  hotelId: string;
  guestId: string;
}) {
  const guest = useGuest(hotelId, guestId);
  const reservations = useReservations(hotelId);
  const consent = useGuestConsent(hotelId, guestId);
  const conversations = useWhatsappConversations(hotelId);

  const guestReservations = useMemo(
    () => (reservations.data ?? []).filter((reservation) => reservation.guest_id === guestId),
    [guestId, reservations.data],
  );

  const conversation = useMemo(() => {
    if (!guest.data) {
      return null;
    }

    return (
      (conversations.data ?? []).find((item) => item.guest_id === guestId) ??
      (conversations.data ?? []).find((item) =>
        [guest.data?.whatsapp_phone, guest.data?.phone].filter(Boolean).includes(item.phone),
      ) ??
      null
    );
  }, [conversations.data, guest.data, guestId]);

  if (guest.isLoading || reservations.isLoading || conversations.isLoading) {
    return <DataState isLoading />;
  }

  if (guest.error || reservations.error || conversations.error) {
    return <DataState error={guest.error ?? reservations.error ?? conversations.error} />;
  }

  if (!guest.data) {
    return <DataState empty emptyTitle="Guest not found." />;
  }

  const totalStays = guestReservations.filter((reservation) =>
    reservation.status.toLowerCase().includes("checked_out"),
  ).length;
  const activeReservation = guestReservations.find((reservation) =>
    reservation.status.toLowerCase().includes("checked_in"),
  );

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Button asChild type="button" variant="ghost">
            <Link href={`/${hotelId}/guests`}>
              <ArrowLeft />
              Guests
            </Link>
          </Button>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-md bg-[#0F3D91] text-white">
              <UserRound className="size-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{guest.data.name}</h2>
              <p className="text-sm text-slate-500">{compactId(guest.data.id)}</p>
            </div>
          </div>
        </div>
        <Badge variant={guestStatusVariant(guest.data.status)}>{titleCase(guest.data.status)}</Badge>
      </div>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="grid gap-3 sm:grid-cols-3">
          <Detail icon={Phone} label="Phone" value={guest.data.phone ?? "No phone"} />
          <Detail icon={MessageCircle} label="WhatsApp" value={guest.data.whatsapp_phone ?? "No WhatsApp"} />
          <Detail icon={Mail} label="Email" value={guest.data.email ?? "No email"} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <Metric label="Reservations" value={String(guestReservations.length)} />
          <Metric label="Completed stays" value={String(totalStays)} />
          <Metric label="Current stay" value={activeReservation ? activeReservation.reservation_no : "None"} />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <ReservationHistory hotelId={hotelId} reservations={guestReservations} />
        <GuestCommunication hotelId={hotelId} conversation={conversation} />
      </div>

      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-[#0F3D91]" />
          <h3 className="text-base font-semibold">Consent</h3>
        </div>
        {consent.isLoading ? (
          <DataState isLoading />
        ) : consent.error ? (
          <DataState error={consent.error} />
        ) : consent.data ? (
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label="WhatsApp" value={consent.data.whatsapp_opt_in ? "Opted in" : "No"} />
            <Metric label="Marketing" value={consent.data.marketing_opt_in ? "Opted in" : "No"} />
            <Metric label="Email" value={consent.data.email_opt_in ? "Opted in" : "No"} />
            <Metric label="SMS" value={consent.data.sms_opt_in ? "Opted in" : "No"} />
          </div>
        ) : (
          <DataState empty emptyTitle="No consent record yet." />
        )}
      </section>
    </div>
  );
}

function ReservationHistory({
  hotelId,
  reservations,
}: {
  hotelId: string;
  reservations: Reservation[];
}) {
  return (
    <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="size-4 text-[#0F3D91]" />
        <h3 className="text-base font-semibold">Reservation History</h3>
      </div>
      {!reservations.length ? (
        <DataState empty emptyTitle="No reservations for this guest." />
      ) : (
        <div className="grid gap-2">
          {reservations.map((reservation) => (
            <Link
              className="grid gap-2 rounded-md border border-slate-200 p-3 transition-colors hover:border-[#0F3D91]"
              href={`/${hotelId}/reservations/${reservation.id}`}
              key={reservation.id}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{reservation.reservation_no}</p>
                <Badge variant={reservationStatusVariant(reservation.status)}>
                  {titleCase(reservation.status)}
                </Badge>
              </div>
              <p className="text-sm text-slate-500">
                {formatDate(reservation.checkin_date)} to {formatDate(reservation.checkout_date)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function GuestCommunication({
  conversation,
  hotelId,
}: {
  conversation: WhatsAppConversation | null;
  hotelId: string;
}) {
  const messages = useWhatsappMessages(hotelId, conversation?.id ?? "");

  return (
    <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-[#0F3D91]" />
          <h3 className="text-base font-semibold">Communication History</h3>
        </div>
        {conversation ? (
          <Button asChild size="sm" type="button" variant="secondary">
            <Link href={`/${hotelId}/whatsapp/conversations/${conversation.id}`}>Open thread</Link>
          </Button>
        ) : null}
      </div>
      {!conversation ? (
        <DataState empty emptyTitle="No WhatsApp conversation recorded for this guest." />
      ) : messages.isLoading ? (
        <DataState isLoading />
      ) : messages.error ? (
        <DataState error={messages.error} />
      ) : !messages.data?.length ? (
        <DataState empty emptyTitle="No messages in this conversation yet." />
      ) : (
        <div className="grid max-h-[34rem] gap-3 overflow-y-auto pr-1">
          {messages.data.map((message) => (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={message.id}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <Badge variant={message.direction === "outbound" ? "blue" : "green"}>
                  {titleCase(message.direction)}
                </Badge>
                <span className="text-xs text-slate-500">
                  {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm text-slate-800">
                {message.message_text ?? titleCase(message.message_type)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
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
      <p className="mt-2 break-words text-sm font-medium">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
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

function reservationStatusVariant(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("check") || normalized.includes("stay")) {
    return "green";
  }
  if (normalized.includes("cancel")) {
    return "rose";
  }
  if (normalized.includes("book")) {
    return "blue";
  }
  return "default";
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return format(new Date(value), "dd MMM yyyy");
}
