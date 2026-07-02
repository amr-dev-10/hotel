"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, Clock, Loader2, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { toast } from "sonner";
import { showApiErrorToast } from "@/lib/api/error-toast";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMarkNotificationRead } from "@/features/notifications/hooks/useNotifications";
import { useAcceptTicket, useRejectTicket } from "@/features/tickets/hooks/useTickets";
import { compactId } from "@/lib/utils";
import { useNotificationStore } from "@/stores/notification.store";

export function DispatchAlert({ hotelId }: { hotelId: string }) {
  const dispatch = useNotificationStore((state) => state.activeDispatch);
  const setActiveDispatch = useNotificationStore((state) => state.setActiveDispatch);
  const markReadInStore = useNotificationStore((state) => state.markRead);
  const acceptTicket = useAcceptTicket(hotelId);
  const rejectTicket = useRejectTicket(hotelId);
  const markRead = useMarkNotificationRead(hotelId);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setRejecting(false);
    setReason("");
  }, [dispatch?.acceptance_id]);

  useEffect(() => {
    if (!dispatch) {
      return undefined;
    }
    setNow(Date.now());
    playBeep();
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const sound = window.setInterval(playBeep, 5000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(sound);
    };
  }, [dispatch]);

  const remaining = useMemo(() => {
    if (!dispatch?.expires_at) {
      return null;
    }
    return Math.max(0, Date.parse(dispatch.expires_at) - now);
  }, [dispatch?.expires_at, now]);

  if (!dispatch) {
    return null;
  }
  const activeDispatch = dispatch;

  async function closeAndMarkRead() {
    if (activeDispatch.notification_id) {
      markReadInStore(activeDispatch.notification_id);
      await markRead.mutateAsync(activeDispatch.notification_id).catch(() => undefined);
    }
    setActiveDispatch(null);
  }

  async function accept() {
    try {
      await acceptTicket.mutateAsync(activeDispatch.ticket.id);
      toast.success("Ticket accepted");
      await closeAndMarkRead();
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  async function reject() {
    if (!rejecting) {
      setRejecting(true);
      return;
    }
    try {
      await rejectTicket.mutateAsync({ ticketId: activeDispatch.ticket.id, reason: reason.trim() || undefined });
      toast.success("Ticket rejected");
      await closeAndMarkRead();
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-md border border-[var(--primary-soft)] bg-[var(--panel)] p-4 text-[var(--foreground)] shadow-[var(--shadow-panel)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
            <BellRing className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">New Ticket Dispatch</p>
            <p className="mt-1 text-base font-semibold text-[var(--foreground)]">{activeDispatch.ticket.ticket_code}</p>
            <p className="mt-1 line-clamp-2 text-sm text-[var(--muted-strong)]">{activeDispatch.ticket.item_description}</p>
          </div>
        </div>
        <Button aria-label="Dismiss dispatch alert" size="icon" type="button" variant="ghost" onClick={() => setActiveDispatch(null)}>
          <X />
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-[var(--muted)]">
        <Info
          label="Room"
          value={activeDispatch.ticket.room_number ? `Room ${activeDispatch.ticket.room_number}` : compactId(activeDispatch.ticket.room_id)}
        />
        <Info label="Priority" value={`P${activeDispatch.ticket.priority}`} />
        <Info label="Source" value={activeDispatch.ticket.source} />
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-md bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning)]">
        <Clock className="size-4" />
        {remaining == null ? "Escalation timer active" : `Auto-escalates in ${formatRemaining(remaining)}`}
      </div>

      {rejecting ? (
        <div className="mt-3 grid gap-2">
          <Textarea
            className="min-h-20"
            placeholder="Reason for rejection"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {["Busy with another task", "Not my area", "Unable to attend"].map((item) => (
              <Button key={item} size="sm" type="button" variant="secondary" onClick={() => setReason(item)}>
                {item}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button disabled={acceptTicket.isPending || rejectTicket.isPending} type="button" onClick={accept}>
          {acceptTicket.isPending ? <Loader2 className="animate-spin" /> : <ThumbsUp />}
          Accept
        </Button>
        <Button disabled={acceptTicket.isPending || rejectTicket.isPending} type="button" variant="secondary" onClick={reject}>
          {rejectTicket.isPending ? <Loader2 className="animate-spin" /> : <ThumbsDown />}
          {rejecting ? "Confirm reject" : "Reject"}
        </Button>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[var(--panel-muted)] p-2">
      <p className="font-semibold uppercase tracking-normal text-[var(--muted)]">{label}</p>
      <p className="mt-1 truncate font-medium text-[var(--muted-strong)]">{value}</p>
    </div>
  );
}

function formatRemaining(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function playBeep() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.03;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.16);
    window.setTimeout(() => context.close(), 250);
  } catch {
    // Browsers can block audio until the first user gesture.
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
