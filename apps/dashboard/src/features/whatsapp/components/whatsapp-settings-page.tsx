"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MessageCircle, Save } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Select } from "@/components/ui/select";
import { showApiErrorToast } from "@/lib/api/error-toast";
import { titleCase } from "@/lib/utils";
import { useSaveWhatsappAccount, useWhatsappAccount, useWhatsappHealth } from "@/features/whatsapp/hooks/useWhatsapp";

export function WhatsAppSettingsPage({ hotelId }: { hotelId: string }) {
  const account = useWhatsappAccount(hotelId);
  const health = useWhatsappHealth(hotelId);
  const saveAccount = useSaveWhatsappAccount(hotelId);
  const [businessName, setBusinessName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [webhookToken, setWebhookToken] = useState("");
  const [status, setStatus] = useState("active");

  useEffect(() => {
    if (!account.data) {
      return;
    }

    setBusinessName(account.data.business_name);
    setPhoneNumber(account.data.phone_number ?? "");
    setPhoneNumberId(account.data.phone_number_id);
    setWabaId(account.data.waba_id ?? "");
    setWebhookToken(account.data.webhook_verify_token ?? "");
    setStatus(account.data.status);
  }, [account.data]);

  async function handleSave() {
    try {
      await saveAccount.mutateAsync({
        business_name: businessName,
        phone_number: phoneNumber || null,
        phone_number_id: phoneNumberId,
        waba_id: wabaId || null,
        access_token: accessToken || null,
        webhook_verify_token: webhookToken || null,
        status,
        onboarding_step: "connected",
      });
      setAccessToken("");
      toast.success("WhatsApp account saved");
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  if (account.isLoading) {
    return <DataState isLoading />;
  }

  if (account.error) {
    return <DataState error={account.error} />;
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <PageBreadcrumbs
          current="WhatsApp Settings"
          description="Meta business account and webhook connection."
          hotelId={hotelId}
          items={[{ label: "WhatsApp", href: `/${hotelId}/whatsapp` }]}
        />
        <Button asChild type="button" variant="secondary">
          <Link href={`/${hotelId}/whatsapp`}>Inbox</Link>
        </Button>
      </div>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
              <MessageCircle className="size-6" />
            </span>
            <div>
              <h3 className="text-base font-semibold">{account.data?.business_name ?? "No account"}</h3>
              <p className="text-sm text-slate-500">{account.data?.phone_number ?? "Phone number not set"}</p>
            </div>
          </div>
          <Badge variant={account.data?.status === "active" ? "green" : "amber"}>
            {titleCase(account.data?.status)}
          </Badge>
        </div>

        {health.data?.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {health.data.map((row) => (
              <div className="rounded-md bg-slate-50 p-3 text-sm" key={row.id}>
                <p className="font-semibold">Token {titleCase(row.token_status)}</p>
                <p className="text-slate-500">Webhook {titleCase(row.webhook_status)}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Business name" id="wa-business">
            <Input id="wa-business" value={businessName} onChange={(event) => setBusinessName(event.target.value)} />
          </Field>
          <Field label="Phone number" id="wa-phone">
            <Input id="wa-phone" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />
          </Field>
          <Field label="Phone number ID" id="wa-phone-id">
            <Input id="wa-phone-id" value={phoneNumberId} onChange={(event) => setPhoneNumberId(event.target.value)} />
          </Field>
          <Field label="WABA ID" id="wa-waba">
            <Input id="wa-waba" value={wabaId} onChange={(event) => setWabaId(event.target.value)} />
          </Field>
          <Field label="Access token" id="wa-token">
            <PasswordInput
              id="wa-token"
              placeholder="Write-only token"
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
            />
          </Field>
          <Field label="Webhook verify token" id="wa-webhook">
            <Input id="wa-webhook" value={webhookToken} onChange={(event) => setWebhookToken(event.target.value)} />
          </Field>
          <Field label="Status" id="wa-status">
            <Select id="wa-status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="disabled">Disabled</option>
            </Select>
          </Field>
        </div>

        <div className="flex justify-end">
          <Button disabled={saveAccount.isPending || businessName.length < 2 || phoneNumberId.length < 2} type="button" onClick={handleSave}>
            {saveAccount.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            Save account
          </Button>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
