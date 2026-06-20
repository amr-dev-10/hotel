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
  FileText,
  Clock,
  Ticket
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DataState } from "@/components/ui/data-state";
import { compactId, titleCase } from "@/lib/utils";
import type { Reservation, WhatsAppConversation } from "@/types/domain";
import { useGuest, useGuestConsent, useGuestTimeline, useUpdateGuest } from "@/features/guests/hooks/useGuests";
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
        <GuestTimeline hotelId={hotelId} guestId={guestId} />
        
        <div className="flex flex-col gap-5">
          <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-[#0F3D91]" />
              <h3 className="text-base font-semibold">Internal Notes</h3>
            </div>
            <InternalNotes hotelId={hotelId} guestId={guestId} initialNotes={guest.data.internal_notes || ""} />
          </section>

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
              <div className="grid gap-3 sm:grid-cols-2">
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
      </div>
    </div>
  );
}

function InternalNotes({ hotelId, guestId, initialNotes }: { hotelId: string, guestId: string, initialNotes: string }) {
  const updateGuest = useUpdateGuest(hotelId, guestId);

  return (
    <div className="grid gap-2">
      <Textarea 
        defaultValue={initialNotes}
        placeholder="Add private notes about this guest..."
        className="min-h-[120px] text-sm"
        onBlur={(e) => {
          if (e.target.value !== initialNotes) {
            updateGuest.mutate({ internal_notes: e.target.value });
          }
        }}
      />
      <p className="text-xs text-slate-500">Notes are auto-saved when you click away.</p>
    </div>
  );
}

function GuestTimeline({ hotelId, guestId }: { hotelId: string, guestId: string }) {
  const timeline = useGuestTimeline(hotelId, guestId);

  return (
    <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-[#0F3D91]" />
          <h3 className="text-base font-semibold">Guest Timeline</h3>
        </div>
      </div>
      
      {timeline.isLoading ? (
        <DataState isLoading />
      ) : timeline.error ? (
        <DataState error={timeline.error} />
      ) : !timeline.data?.length ? (
        <DataState empty emptyTitle="No timeline events." />
      ) : (
        <div className="relative border-l border-slate-200 ml-3 mt-4 space-y-6 pb-4">
          {timeline.data.map((event) => (
            <div key={event.id} className="relative pl-6">
              <div className="absolute -left-2.5 top-1 flex size-5 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm text-slate-500">
                {event.event_type === "reservation" && <CalendarDays className="size-3 text-blue-600" />}
                {event.event_type === "whatsapp_message" && <MessageCircle className="size-3 text-green-600" />}
                {event.event_type === "ticket" && <Ticket className="size-3 text-amber-600" />}
              </div>
              <div className="grid gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{event.title}</span>
                  {event.status && <Badge variant="secondary" className="h-4 text-[10px] uppercase">{event.status}</Badge>}
                  <span className="text-xs text-slate-400 ml-auto">
                    {format(new Date(event.timestamp), "MMM d, h:mm a")}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{event.description}</p>
                {event.metadata && Object.keys(event.metadata).length > 0 && (
                  <div className="mt-1 flex gap-2 text-xs text-slate-500">
                    {Object.entries(event.metadata).map(([k, v]) => (
                      <span key={k} className="bg-slate-100 px-1.5 py-0.5 rounded">{k}: {v as string}</span>
                    ))}
                  </div>
                )}
              </div>
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
