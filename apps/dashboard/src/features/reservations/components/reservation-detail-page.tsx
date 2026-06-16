"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Ban,
  BedDouble,
  CalendarDays,
  CreditCard,
  History,
  LogIn,
  LogOut,
  MessageCircle,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Can } from "@/lib/auth/can";
import { apiErrorMessage } from "@/lib/api/client";
import { compactId, money, titleCase } from "@/lib/utils";
import type { Folio, StayRecord, WhatsAppConversation } from "@/types/domain";
import { useGuests } from "@/features/guests/hooks/useGuests";
import { useRooms } from "@/features/rooms/hooks/useRooms";
import { CancelReservationDialog } from "@/features/reservations/components/cancel-reservation-dialog";
import {
  useCancelReservation,
  useCheckInReservation,
  useCheckOutReservation,
  useReservation,
  useReservationFolios,
  useReservationGuests,
  useReservationStays,
} from "@/features/reservations/hooks/useReservations";
import {
  useWhatsappConversations,
  useWhatsappMessages,
} from "@/features/whatsapp/hooks/useWhatsapp";

export function ReservationDetailPage({
  hotelId,
  reservationId,
}: {
  hotelId: string;
  reservationId: string;
}) {
  const reservation = useReservation(hotelId, reservationId);
  const guests = useGuests(hotelId);
  const rooms = useRooms(hotelId);
  const reservationGuests = useReservationGuests(hotelId, reservationId);
  const stays = useReservationStays(hotelId, reservationId);
  const folios = useReservationFolios(hotelId, reservationId);
  const conversations = useWhatsappConversations(hotelId);
  const checkIn = useCheckInReservation(hotelId);
  const checkOut = useCheckOutReservation(hotelId);
  const cancelReservation = useCancelReservation(hotelId);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const guest = reservation.data ? guests.data?.find((item) => item.id === reservation.data.guest_id) : null;
  const room = reservation.data ? rooms.data?.find((item) => item.id === reservation.data?.room_id) : null;
  const conversation = useMemo(() => {
    if (!reservation.data) {
      return null;
    }

    return (
      (conversations.data ?? []).find((item) => item.guest_id === reservation.data?.guest_id) ??
      (conversations.data ?? []).find((item) =>
        [guest?.whatsapp_phone, guest?.phone].filter(Boolean).includes(item.phone),
      ) ??
      null
    );
  }, [conversations.data, guest?.phone, guest?.whatsapp_phone, reservation.data]);

  async function handleCheckIn() {
    try {
      await checkIn.mutateAsync(reservationId);
      toast.success("Reservation checked in");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  async function handleCheckOut() {
    try {
      await checkOut.mutateAsync(reservationId);
      toast.success("Reservation checked out");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  async function handleCancel(reason: string) {
    try {
      await cancelReservation.mutateAsync({ reservationId, reason });
      toast.success("Reservation cancelled");
      setCancelDialogOpen(false);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  if (reservation.isLoading || guests.isLoading || rooms.isLoading || conversations.isLoading) {
    return <DataState isLoading />;
  }

  if (reservation.error || guests.error || rooms.error || conversations.error) {
    return <DataState error={reservation.error ?? guests.error ?? rooms.error ?? conversations.error} />;
  }

  if (!reservation.data) {
    return <DataState empty emptyTitle="Reservation not found." />;
  }

  const canCancel = isReservationCancelable(reservation.data);
  const canCheckIn = canCancel;
  const canCheckOut = reservation.data.status === "checked_in";

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Button asChild type="button" variant="ghost">
            <Link href={`/${hotelId}/reservations`}>
              <ArrowLeft />
              Reservations
            </Link>
          </Button>
          <h2 className="mt-2 text-xl font-semibold">{reservation.data.reservation_no}</h2>
          <p className="text-sm text-slate-500">{titleCase(reservation.data.source)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={statusVariant(reservation.data.status)}>{titleCase(reservation.data.status)}</Badge>
          <Can I="edit" a="Reservation">
            {canCheckIn ? (
              <Button disabled={checkIn.isPending} size="sm" type="button" variant="secondary" onClick={handleCheckIn}>
                <LogIn />
                Check in
              </Button>
            ) : null}
            {canCheckOut ? (
              <Button disabled={checkOut.isPending} size="sm" type="button" variant="secondary" onClick={handleCheckOut}>
                <LogOut />
                Check out
              </Button>
            ) : null}
            {canCancel ? (
              <Button size="sm" type="button" variant="danger" onClick={() => setCancelDialogOpen(true)}>
                <Ban />
                Cancel
              </Button>
            ) : null}
          </Can>
        </div>
      </div>

      {reservation.data.status === "cancelled" ? (
        <section className="grid gap-2 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <h3 className="font-semibold">Reservation Cancelled</h3>
          <p>
            {reservation.data.cancelled_at ? `Cancelled ${formatDateTime(reservation.data.cancelled_at)}.` : "Cancelled."}
            {reservation.data.cancellation_reason ? ` Reason: ${reservation.data.cancellation_reason}` : ""}
          </p>
        </section>
      ) : null}

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 lg:grid-cols-4">
        <Detail icon={UserRound} label="Guest" value={guest?.name ?? compactId(reservation.data.guest_id)} />
        <Detail
          icon={BedDouble}
          label="Room"
          value={room ? `${room.room_number}${room.room_type ? ` - ${room.room_type}` : ""}` : compactId(reservation.data.room_id)}
        />
        <Detail icon={CalendarDays} label="Check-in" value={formatDate(reservation.data.checkin_date)} />
        <Detail icon={CalendarDays} label="Check-out" value={formatDate(reservation.data.checkout_date)} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <UserRound className="size-4 text-[#0F3D91]" />
              <h3 className="text-base font-semibold">Guest Summary</h3>
            </div>
            {guest ? (
              <Button asChild size="sm" type="button" variant="secondary">
                <Link href={`/${hotelId}/guests/${guest.id}`}>Open profile</Link>
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Name" value={guest?.name ?? compactId(reservation.data.guest_id)} />
            <Metric label="Phone" value={guest?.phone ?? "No phone"} />
            <Metric label="WhatsApp" value={guest?.whatsapp_phone ?? "No WhatsApp"} />
          </div>

          {reservationGuests.isLoading ? (
            <DataState isLoading />
          ) : reservationGuests.error ? (
            <DataState error={reservationGuests.error} />
          ) : reservationGuests.data?.length ? (
            <div className="grid gap-2">
              {reservationGuests.data.map((item) => {
                const linkedGuest = guests.data?.find((guestItem) => guestItem.id === item.guest_id);
                return (
                  <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 p-3" key={item.id}>
                    <div>
                      <p className="font-medium">{linkedGuest?.name ?? compactId(item.guest_id)}</p>
                      <p className="text-xs text-slate-500">{titleCase(item.relationship ?? "Guest")}</p>
                    </div>
                    {item.is_primary ? <Badge variant="blue">Primary</Badge> : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>

        <PaymentSummary folios={folios.data ?? []} isLoading={folios.isLoading} error={folios.error} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <StayHistory stays={stays.data ?? []} isLoading={stays.isLoading} error={stays.error} />
        <ReservationCommunication conversation={conversation} hotelId={hotelId} />
      </div>

      {reservation.data.notes ? (
        <section className="grid gap-2 rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold">Notes</h3>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{reservation.data.notes}</p>
        </section>
      ) : null}

      <CancelReservationDialog
        isPending={cancelReservation.isPending}
        open={cancelDialogOpen}
        reservation={reservation.data}
        onConfirm={handleCancel}
        onOpenChange={setCancelDialogOpen}
      />
    </div>
  );
}

function isReservationCancelable(reservation: { status: string }) {
  return ["booked", "confirmed"].includes(reservation.status.toLowerCase());
}

function PaymentSummary({
  error,
  folios,
  isLoading,
}: {
  error: unknown;
  folios: Folio[];
  isLoading: boolean;
}) {
  const totals = folios.reduce(
    (sum, folio) => ({
      charges: sum.charges + Number(folio.total_charges ?? 0),
      payments: sum.payments + Number(folio.total_payments ?? 0),
      balance: sum.balance + Number(folio.balance_due ?? 0),
    }),
    { charges: 0, payments: 0, balance: 0 },
  );

  return (
    <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <CreditCard className="size-4 text-[#0F3D91]" />
        <h3 className="text-base font-semibold">Payment Summary</h3>
      </div>
      {isLoading ? (
        <DataState isLoading />
      ) : error ? (
        <DataState error={error} />
      ) : !folios.length ? (
        <DataState empty emptyTitle="No folio found for this reservation." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Charges" value={money(totals.charges)} />
            <Metric label="Payments" value={money(totals.payments)} />
            <Metric label="Balance" value={money(totals.balance)} />
          </div>
          <div className="grid gap-2">
            {folios.map((folio) => (
              <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 p-3" key={folio.id}>
                <div>
                  <p className="font-medium">{folio.folio_number}</p>
                  <p className="text-xs text-slate-500">{titleCase(folio.status)}</p>
                </div>
                <Badge variant={Number(folio.balance_due) > 0 ? "amber" : "green"}>
                  {money(folio.balance_due)}
                </Badge>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function StayHistory({
  error,
  isLoading,
  stays,
}: {
  error: unknown;
  isLoading: boolean;
  stays: StayRecord[];
}) {
  return (
    <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <History className="size-4 text-[#0F3D91]" />
        <h3 className="text-base font-semibold">Past Check-ins</h3>
      </div>
      {isLoading ? (
        <DataState isLoading />
      ) : error ? (
        <DataState error={error} />
      ) : !stays.length ? (
        <DataState empty emptyTitle="No stay records yet." />
      ) : (
        <div className="grid gap-2">
          {stays.map((stay) => (
            <div className="grid gap-2 rounded-md border border-slate-200 p-3" key={stay.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">Room {compactId(stay.room_id)}</p>
                <Badge variant={stay.actual_checkout ? "teal" : "green"}>
                  {stay.actual_checkout ? "Checked out" : "In stay"}
                </Badge>
              </div>
              <p className="text-sm text-slate-500">
                {formatDateTime(stay.actual_checkin)} to {formatDateTime(stay.actual_checkout)}
              </p>
              {stay.notes ? <p className="text-sm text-slate-700">{stay.notes}</p> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ReservationCommunication({
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
          <h3 className="text-base font-semibold">Communication Timeline</h3>
        </div>
        {conversation ? (
          <Button asChild size="sm" type="button" variant="secondary">
            <Link href={`/${hotelId}/whatsapp/conversations/${conversation.id}`}>Open thread</Link>
          </Button>
        ) : null}
      </div>
      {!conversation ? (
        <DataState empty emptyTitle="No WhatsApp conversation recorded for this reservation guest." />
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
      <p className="mt-2 truncate text-sm font-semibold">{value}</p>
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

function statusVariant(status: string) {
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

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return format(new Date(value), "dd MMM yyyy, HH:mm");
}
