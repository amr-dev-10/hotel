"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Search, UserCheck, UserPlus, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EntitySearchSelect, type EntitySearchOption } from "@/components/ui/entity-search-select";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { apiErrorMessage } from "@/lib/api/client";
import { useRooms } from "@/features/rooms/hooks/useRooms";
import { useGuests } from "@/features/guests/hooks/useGuests";
import {
  createReservationSchema,
  type CreateReservationValues,
} from "@/features/reservations/schemas/create-reservation.schema";
import { useCreateReservation } from "@/features/reservations/hooks/useReservations";
import type { Guest } from "@/types/domain";

export function CreateReservationDialog({ hotelId }: { hotelId: string }) {
  const [open, setOpen] = useState(false);
  const [guestSearch, setGuestSearch] = useState("");
  const [roomSearch, setRoomSearch] = useState("");
  const [selectedRoomLabel, setSelectedRoomLabel] = useState("");
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [showGuestSearch, setShowGuestSearch] = useState(false);
  const debouncedRoomSearch = useDebouncedValue(roomSearch.trim(), 250);

  const rooms = useRooms(hotelId, {
    enabled: open && debouncedRoomSearch.length > 0,
    q: debouncedRoomSearch,
    limit: 8,
  });
  const guests = useGuests(hotelId, { q: guestSearch.trim() || undefined, limit: 6 });
  const createReservation = useCreateReservation(hotelId);

  const form = useForm<CreateReservationValues>({
    resolver: zodResolver(createReservationSchema),
    defaultValues: {
      guest_name: "",
      phone: "",
      whatsapp_phone: "",
      room_id: "",
      room_type_id: "",
      checkin_date: format(new Date(), "yyyy-MM-dd"),
      checkout_date: format(addDays(new Date(), 1), "yyyy-MM-dd"),
      source: "walk_in",
      notes: "",
    },
  });

  const filteredGuests = useMemo(() => {
    if (!guestSearch.trim()) {
      return [];
    }
    return guests.data ?? [];
  }, [guestSearch, guests.data]);

  const roomOptions: EntitySearchOption[] = (rooms.data ?? []).map((room) => ({
    value: room.id,
    label: `Room ${room.room_number}`,
    description: [room.room_type, room.floor ? `Floor ${room.floor}` : null, room.status].filter(Boolean).join(" - "),
  }));

  function handleSelectGuest(guest: Guest) {
    setSelectedGuest(guest);
    setGuestSearch("");
    setShowGuestSearch(false);
    form.setValue("guest_name", guest.name || "");
    form.setValue("phone", guest.phone || "");
    form.setValue("whatsapp_phone", guest.whatsapp_phone || "");
  }

  function handleClearGuest() {
    setSelectedGuest(null);
    form.setValue("guest_name", "");
    form.setValue("phone", "");
    form.setValue("whatsapp_phone", "");
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createReservation.mutateAsync({
        ...values,
        phone: values.phone || undefined,
        whatsapp_phone: values.whatsapp_phone || undefined,
        room_id: values.room_id || undefined,
        room_type_id: values.room_type_id || undefined,
        notes: values.notes || undefined,
        guests: selectedGuest
          ? [{ guest_id: selectedGuest.id, is_primary: true, relationship: "self" }]
          : undefined,
      });
      toast.success("Reservation created");
      form.reset();
      setSelectedGuest(null);
      setRoomSearch("");
      setSelectedRoomLabel("");
      setOpen(false);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <Plus />
          New reservation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Reservation</DialogTitle>
          <DialogDescription>
            Search for an existing guest or enter details for a new guest.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={onSubmit}>

          {/* Guest selector */}
          <div className="grid gap-2">
            <Label>Guest</Label>

            {selectedGuest ? (
              // Existing guest selected — show card
              <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="size-4 text-green-600" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{selectedGuest.name}</p>
                    <p className="text-xs text-slate-500">{selectedGuest.phone || selectedGuest.whatsapp_phone || "No phone"}</p>
                  </div>
                  <Badge variant="green" className="text-[10px]">Existing Guest</Badge>
                </div>
                <button type="button" onClick={handleClearGuest} className="text-slate-400 hover:text-slate-600">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              // Guest search
              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search existing guests by name or phone..."
                      className="pl-9"
                      value={guestSearch}
                      onChange={(e) => {
                        setGuestSearch(e.target.value);
                        setShowGuestSearch(true);
                      }}
                      onFocus={() => setShowGuestSearch(true)}
                    />
                  </div>
                </div>

                {showGuestSearch && filteredGuests.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
                    {filteredGuests.map((guest) => (
                      <button
                        key={guest.id}
                        type="button"
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0"
                        onClick={() => handleSelectGuest(guest)}
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0F3D91]/10 text-xs font-bold text-[#0F3D91]">
                          {guest.name?.[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{guest.name}</p>
                          <p className="text-xs text-slate-500">{guest.phone || guest.whatsapp_phone || guest.email || "No contact"}</p>
                        </div>
                        <Badge variant={guest.status === "checked_in" ? "green" : "default"} className="ml-auto shrink-0 text-[10px]">
                          {guest.status}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}

                {showGuestSearch && guestSearch && filteredGuests.length === 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg px-3 py-3">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <UserPlus className="size-4" />
                      No existing guest found — a new guest will be created.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* New guest fields — shown when no guest selected */}
          {!selectedGuest && (
            <div className="grid gap-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">New Guest Details</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="guest_name">Full Name *</Label>
                  <Input id="guest_name" placeholder="John Smith" {...form.register("guest_name")} />
                  {form.formState.errors.guest_name && (
                    <p className="text-xs text-rose-600">{form.formState.errors.guest_name.message}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" placeholder="+92 300 1234567" {...form.register("phone")} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="whatsapp_phone">WhatsApp Number</Label>
                <Input id="whatsapp_phone" placeholder="+92 300 1234567" {...form.register("whatsapp_phone")} />
                <p className="text-xs text-slate-400">If different from phone. Used to send WhatsApp confirmation.</p>
              </div>
            </div>
          )}

          {/* Stay details */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="checkin_date">Check-in</Label>
              <Input id="checkin_date" type="date" {...form.register("checkin_date")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="checkout_date">Check-out</Label>
              <Input id="checkout_date" type="date" {...form.register("checkout_date")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="source">Source</Label>
              <Select id="source" {...form.register("source")}>
                <option value="walk_in">Walk-in</option>
                <option value="direct">Direct</option>
                <option value="ota">OTA</option>
                <option value="corporate">Corporate</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="room_id">Room</Label>
            <EntitySearchSelect
              emptyText="No rooms found"
              id="room_id"
              isLoading={rooms.isFetching}
              options={roomOptions}
              placeholder="Type room number or leave blank"
              search={roomSearch}
              selectedLabel={selectedRoomLabel}
              value={form.watch("room_id") ?? ""}
              onSearchChange={setRoomSearch}
              onValueChange={(value, option) => {
                form.setValue("room_id", value, { shouldValidate: true });
                setSelectedRoomLabel(option?.label ?? "");
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes / Special Requests</Label>
            <Textarea id="notes" placeholder="Any special requests or notes..." {...form.register("notes")} />
          </div>

          {form.formState.errors.checkout_date ? (
            <p className="text-xs text-rose-700">{form.formState.errors.checkout_date.message}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={createReservation.isPending} type="submit">
              {createReservation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              Create Reservation
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}
