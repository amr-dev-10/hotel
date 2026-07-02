"use client";

import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Hotel, KeyRound, Phone, RectangleEllipsis } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGuestLogin, useGuestTokenLogin } from "@/features/guest-portal/hooks/useGuestPortal";
import { useGuestSessionStore } from "@/stores/guest-session.store";

export function GuestLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useGuestSessionStore((state) => state.token);
  const login = useGuestLogin();
  const tokenLogin = useGuestTokenLogin();
  const [attemptedLinkToken, setAttemptedLinkToken] = useState<string | null>(null);
  const [hotelId, setHotelId] = useState("");
  const [phone, setPhone] = useState("");
  const [roomNumber, setRoomNumber] = useState("");

  useEffect(() => {
    if (token) {
      router.replace("/guest/menu");
    }
  }, [router, token]);

  useEffect(() => {
    const linkToken = searchParams.get("token");
    if (!linkToken || tokenLogin.isPending || token || attemptedLinkToken === linkToken) {
      return;
    }
    setAttemptedLinkToken(linkToken);
    tokenLogin.mutate(linkToken, {
      onSuccess: () => {
        toast.success("Welcome back");
        router.replace("/guest/menu");
      },
      onError: () => toast.error("Guest link is invalid or expired"),
    });
  }, [attemptedLinkToken, router, searchParams, token, tokenLogin]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await login.mutateAsync(
      { hotel_id: hotelId.trim(), phone: phone.trim(), room_number: roomNumber.trim() },
      {
        onSuccess: () => {
          toast.success("Guest stay verified");
          router.replace("/guest/menu");
        },
        onError: () => toast.error("No active stay matched those details"),
      },
    );
  }

  return (
    <div className="mx-auto grid max-w-md gap-5 py-8">
      <section className="grid gap-3">
        <div className="flex size-12 items-center justify-center rounded-md bg-emerald-700 text-white">
          <Hotel className="size-6" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Order food and request service</h2>
          <p className="mt-2 text-sm text-slate-600">Verify your stay to browse the hotel menu and track requests.</p>
        </div>
      </section>

      <form className="grid gap-4 rounded-md border border-slate-200 bg-white p-4" onSubmit={onSubmit}>
        <Field
          icon={<KeyRound />}
          label="Hotel ID"
          placeholder="Paste hotel workspace ID"
          value={hotelId}
          onChange={setHotelId}
        />
        <Field icon={<Phone />} label="Phone" placeholder="Phone or WhatsApp number" value={phone} onChange={setPhone} />
        <Field
          icon={<RectangleEllipsis />}
          label="Room"
          placeholder="Room number"
          value={roomNumber}
          onChange={setRoomNumber}
        />
        <Button disabled={login.isPending || !hotelId || !phone || !roomNumber} type="submit">
          Continue
        </Button>
        {tokenLogin.isPending ? <p className="text-xs text-slate-500">Verifying your guest link...</p> : null}
      </form>
    </div>
  );
}

function Field({
  icon,
  label,
  placeholder,
  value,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <Label className="flex items-center gap-2 text-xs uppercase tracking-normal text-slate-500">
        <span className="[&_svg]:size-4">{icon}</span>
        {label}
      </Label>
      <Input placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
