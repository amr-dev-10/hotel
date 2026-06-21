"use client";

import { useEffect, useMemo, useState } from "react";
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
  Loader2,
  Pencil,
  Ticket
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Can } from "@/lib/auth/can";
import { apiErrorMessage } from "@/lib/api/client";
import { compactId, titleCase } from "@/lib/utils";
import type { Guest, Reservation, WhatsAppConversation } from "@/types/domain";
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
  const updateGuest = useUpdateGuest(hotelId, guestId);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

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
              <div className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
                Guest DB ID: {guest.data.id}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={guestStatusVariant(guest.data.status)}>{titleCase(guest.data.status)}</Badge>
          <Can I="edit" a="Guest">
            <Button size="sm" type="button" variant="secondary" onClick={() => setEditDialogOpen(true)}>
              <Pencil />
              Edit
            </Button>
          </Can>
          <Button asChild size="sm" variant="secondary">
            <Link href={`/${hotelId}/whatsapp?guest=${guest.data.id}`}>
              <MessageCircle className="mr-2 size-3" />
              Open Communication
            </Link>
          </Button>
        </div>
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
      <EditGuestDialog
        guest={guest.data}
        isPending={updateGuest.isPending}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSubmit={async (payload) => {
          try {
            await updateGuest.mutateAsync(payload);
            toast.success("Guest updated");
            setEditDialogOpen(false);
          } catch (error) {
            toast.error(apiErrorMessage(error));
          }
        }}
      />
    </div>
  );
}

function EditGuestDialog({
  guest,
  isPending,
  open,
  onOpenChange,
  onSubmit,
}: {
  guest: Guest;
  isPending: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: {
    name: string;
    phone: string | null;
    whatsapp_phone: string | null;
    email: string | null;
    check_in_date: string | null;
    check_out_date: string | null;
    status: string;
    internal_notes: string | null;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(guest.name);
  const [phone, setPhone] = useState(guest.phone ?? "");
  const [whatsappPhone, setWhatsappPhone] = useState(guest.whatsapp_phone ?? "");
  const [email, setEmail] = useState(guest.email ?? "");
  const [checkInDate, setCheckInDate] = useState(toDateInput(guest.check_in_date));
  const [checkOutDate, setCheckOutDate] = useState(toDateInput(guest.check_out_date));
  const [status, setStatus] = useState(guest.status);
  const [internalNotes, setInternalNotes] = useState(guest.internal_notes ?? "");

  useEffect(() => {
    if (!open) {
      return;
    }
    setName(guest.name);
    setPhone(guest.phone ?? "");
    setWhatsappPhone(guest.whatsapp_phone ?? "");
    setEmail(guest.email ?? "");
    setCheckInDate(toDateInput(guest.check_in_date));
    setCheckOutDate(toDateInput(guest.check_out_date));
    setStatus(guest.status);
    setInternalNotes(guest.internal_notes ?? "");
  }, [guest, open]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      name,
      phone: phone.trim() || null,
      whatsapp_phone: whatsappPhone.trim() || null,
      email: email.trim() || null,
      check_in_date: checkInDate || null,
      check_out_date: checkOutDate || null,
      status,
      internal_notes: internalNotes.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit guest</DialogTitle>
          <DialogDescription>Update guest profile, contact, stay dates, and private notes.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={save}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Name">
              <Input required value={name} onChange={(event) => setName(event.target.value)} />
            </FormField>
            <FormField label="Status">
              <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="checked_in">Checked in</option>
                <option value="reserved">Reserved</option>
                <option value="pre_arrival">Pre-arrival</option>
                <option value="checked_out">Checked out</option>
                <option value="inactive">Inactive</option>
              </Select>
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Phone">
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
            </FormField>
            <FormField label="WhatsApp">
              <Input value={whatsappPhone} onChange={(event) => setWhatsappPhone(event.target.value)} />
            </FormField>
            <FormField label="Email">
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Check-in">
              <Input type="date" value={checkInDate} onChange={(event) => setCheckInDate(event.target.value)} />
            </FormField>
            <FormField label="Check-out">
              <Input type="date" value={checkOutDate} onChange={(event) => setCheckOutDate(event.target.value)} />
            </FormField>
          </div>
          <FormField label="Internal notes">
            <Textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={isPending || name.trim().length < 2} type="submit">
              {isPending ? <Loader2 className="animate-spin" /> : <Pencil />}
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormField({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </label>
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
          <CalendarDays className="size-4 text-[#0F3D91]" />
          <h3 className="text-base font-semibold">Reservation Timeline</h3>
        </div>
      </div>
      
      {timeline.isLoading ? (
        <DataState isLoading />
      ) : timeline.error ? (
        <DataState error={timeline.error} />
      ) : !timeline.data?.length ? (
        <DataState empty emptyTitle="No reservations found." />
      ) : (
        <div className="relative border-l border-slate-200 ml-3 mt-4 space-y-6 pb-4">
          {timeline.data.map((event) => (
            <div key={event.id} className="relative pl-6">
              <div className="absolute -left-2.5 top-1 flex size-5 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm text-slate-500">
                <CalendarDays className="size-3 text-blue-600" />
              </div>
              <div className="grid gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{event.title}</span>
                  {event.status && <Badge variant="default" className="h-4 text-[10px] uppercase">{event.status}</Badge>}
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

function toDateInput(value: string | null) {
  if (!value) {
    return "";
  }
  return value.slice(0, 10);
}
