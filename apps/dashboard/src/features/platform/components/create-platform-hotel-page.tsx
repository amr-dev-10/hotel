"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2, Copy, Loader2, Plus } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PlatformShell } from "@/features/platform/components/platform-shell";
import { useCreatePlatformHotel } from "@/features/platform/hooks/usePlatform";
import {
  createPlatformHotelSchema,
  type CreatePlatformHotelValues,
} from "@/features/platform/schemas/create-platform-hotel.schema";
import { apiErrorMessage } from "@/lib/api/client";

export function CreatePlatformHotelPage() {
  return (
    <PlatformShell>
      <CreatePlatformHotelContent />
    </PlatformShell>
  );
}

function CreatePlatformHotelContent() {
  const router = useRouter();
  const createHotel = useCreatePlatformHotel();
  const [step, setStep] = useState<1 | 2>(1);
  const [slugEdited, setSlugEdited] = useState(false);
  const [createdHotelId, setCreatedHotelId] = useState<string | null>(null);
  const generatedPassword = useMemo(() => generatePassword(), []);
  const form = useForm<CreatePlatformHotelValues>({
    resolver: zodResolver(createPlatformHotelSchema),
    defaultValues: {
      name: "",
      slug: "",
      owner_name: "",
      owner_email: "",
      owner_password: generatedPassword,
      address: "",
      timezone: "Asia/Kolkata",
      contact_phone: "",
      whatsapp_phone_number_id: "",
      subscription_tier: "starter",
      seed_rooms_text: "101, 102, 103",
    },
  });
  const hotelName = useWatch({ control: form.control, name: "name" });

  useEffect(() => {
    if (!slugEdited) {
      form.setValue("slug", slugify(hotelName ?? ""), { shouldValidate: true });
    }
  }, [form, hotelName, slugEdited]);

  async function handleNext() {
    const valid = await form.trigger([
      "name",
      "slug",
      "timezone",
      "subscription_tier",
      "address",
      "contact_phone",
      "whatsapp_phone_number_id",
      "seed_rooms_text",
    ]);

    if (valid) {
      setStep(2);
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await createHotel.mutateAsync(values);
      setCreatedHotelId(result.hotel.id);
      toast.success("Hotel created");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  });

  if (createdHotelId) {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-5 rounded-md border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Hotel Created</h2>
            <p className="text-sm text-slate-500">The owner account is ready for first login.</p>
          </div>
        </div>
        <div className="grid gap-3 rounded-md bg-slate-50 p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Owner email</p>
            <p className="mt-1 break-words text-sm font-semibold">{form.getValues("owner_email")}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Temporary password</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="rounded bg-white px-2 py-1 text-sm font-semibold">{form.getValues("owner_password")}</code>
              <Button
                aria-label="Copy temporary password"
                size="icon"
                type="button"
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(form.getValues("owner_password"));
                  toast.success("Password copied");
                }}
              >
                <Copy />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button asChild type="button" variant="secondary">
            <Link href={`/platform/hotels/${createdHotelId}`}>Inspect hotel</Link>
          </Button>
          <Button type="button" onClick={() => router.push(`/${createdHotelId}/overview`)}>
            Open hotel dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5">
      <div>
        <Button asChild type="button" variant="ghost">
          <Link href="/platform/hotels">
            <ArrowLeft />
            Hotels
          </Link>
        </Button>
        <h2 className="mt-2 text-xl font-semibold">Create Hotel</h2>
        <p className="text-sm text-slate-500">Create a tenant and first hotel owner account.</p>
      </div>

      <form className="grid gap-5 rounded-md border border-slate-200 bg-white p-5" onSubmit={onSubmit}>
        <div className="flex items-center gap-2">
          <StepPill active={step === 1} label="1. Hotel" />
          <StepPill active={step === 2} label="2. Owner" />
        </div>

        {step === 1 ? (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field error={form.formState.errors.name?.message} id="platform-hotel-name" label="Hotel name">
                <Input id="platform-hotel-name" {...form.register("name")} />
              </Field>
              <Field error={form.formState.errors.slug?.message} id="platform-hotel-slug" label="Slug">
                <Input
                  id="platform-hotel-slug"
                  {...form.register("slug")}
                  onChange={(event) => {
                    setSlugEdited(true);
                    form.setValue("slug", event.target.value, { shouldDirty: true, shouldValidate: true });
                  }}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field error={form.formState.errors.timezone?.message} id="platform-timezone" label="Timezone">
                <Select id="platform-timezone" {...form.register("timezone")}>
                  <option value="Asia/Kolkata">Asia/Kolkata</option>
                  <option value="UTC">UTC</option>
                  <option value="Asia/Dubai">Asia/Dubai</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New_York</option>
                </Select>
              </Field>
              <Field error={form.formState.errors.subscription_tier?.message} id="platform-plan" label="Plan">
                <Select id="platform-plan" {...form.register("subscription_tier")}>
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </Select>
              </Field>
              <Field error={form.formState.errors.contact_phone?.message} id="platform-phone" label="Contact phone">
                <Input id="platform-phone" {...form.register("contact_phone")} />
              </Field>
            </div>

            <Field error={form.formState.errors.address?.message} id="platform-address" label="Address">
              <Textarea id="platform-address" {...form.register("address")} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                error={form.formState.errors.whatsapp_phone_number_id?.message}
                id="platform-whatsapp-id"
                label="WhatsApp phone number ID"
              >
                <Input id="platform-whatsapp-id" {...form.register("whatsapp_phone_number_id")} />
              </Field>
              <Field error={form.formState.errors.seed_rooms_text?.message} id="platform-seed-rooms" label="Seed rooms">
                <Textarea id="platform-seed-rooms" {...form.register("seed_rooms_text")} />
              </Field>
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={handleNext}>
                Next
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field error={form.formState.errors.owner_name?.message} id="platform-owner-name" label="Owner name">
                <Input id="platform-owner-name" {...form.register("owner_name")} />
              </Field>
              <Field error={form.formState.errors.owner_email?.message} id="platform-owner-email" label="Owner email">
                <Input id="platform-owner-email" type="email" {...form.register("owner_email")} />
              </Field>
            </div>

            <Field
              error={form.formState.errors.owner_password?.message}
              id="platform-owner-password"
              label="Temporary password"
            >
              <Input id="platform-owner-password" {...form.register("owner_password")} />
            </Field>

            {createHotel.error ? <DataState error={createHotel.error} /> : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button disabled={createHotel.isPending} type="submit">
                {createHotel.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                Create hotel
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

function Field({
  children,
  error,
  id,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  id: string;
  label: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}

function StepPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={
        active
          ? "rounded bg-slate-950 px-3 py-1 text-xs font-semibold text-white"
          : "rounded bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
      }
    >
      {label}
    </span>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const values = new Uint32Array(14);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => chars[value % chars.length]).join("");
}
