"use client";

import { useEffect, useState } from "react";
import { Ban, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Reservation } from "@/types/domain";

interface CancelReservationDialogProps {
  open: boolean;
  reservation: Reservation | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function CancelReservationDialog({
  open,
  reservation,
  isPending,
  onOpenChange,
  onConfirm,
}: CancelReservationDialogProps) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
    }
  }, [open, reservation?.id]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onConfirm(reason);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Reservation</DialogTitle>
          <DialogDescription>
            {reservation
              ? `${reservation.reservation_no} will be marked cancelled and room availability will be released.`
              : "This reservation will be marked cancelled."}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="reservation-cancel-reason">Cancellation reason</Label>
            <Textarea
              id="reservation-cancel-reason"
              maxLength={500}
              placeholder="Guest request, no-show, duplicate booking"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button disabled={isPending} type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button disabled={isPending} type="submit" variant="danger">
              {isPending ? <Loader2 className="animate-spin" /> : <Ban />}
              Cancel reservation
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
