"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, type LoginValues } from "@/features/auth/schemas/login.schema";
import { platformPost } from "@/lib/api/platform-client";
import { apiErrorMessage } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth.store";
import { usePlatformAuthStore } from "@/stores/platform-auth.store";
import type { PlatformTokenResponse } from "@/types/domain";

export function PlatformLoginForm() {
  const router = useRouter();
  const clearHotelSession = useAuthStore((state) => state.logout);
  const setPlatformSession = usePlatformAuthStore((state) => state.setPlatformSession);
  const clearPlatformSession = usePlatformAuthStore((state) => state.logout);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    clearHotelSession();
    clearPlatformSession();

    try {
      const response = await platformPost<PlatformTokenResponse>("/platform/auth/login", values);
      setPlatformSession({
        token: response.access_token,
        adminName: readJwtName(response.access_token),
        adminEmail: values.email,
      });
      router.replace("/platform");
    } catch (submitError) {
      setError(apiErrorMessage(submitError));
    }
  });

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-7 rounded-md border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-11 items-center justify-center rounded-md bg-slate-950 text-white">
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Arcadia Platform</h1>
          <p className="mt-1 text-sm text-slate-500">Super Admin access for platform operations.</p>
        </div>
      </div>

      <form className="grid gap-4" onSubmit={onSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="platform-email">Email</Label>
          <Input id="platform-email" type="email" autoComplete="email" {...form.register("email")} />
          {form.formState.errors.email ? (
            <p className="text-xs text-rose-700">{form.formState.errors.email.message}</p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="platform-password">Password</Label>
          <Input
            id="platform-password"
            type="password"
            autoComplete="current-password"
            {...form.register("password")}
          />
          {form.formState.errors.password ? (
            <p className="text-xs text-rose-700">{form.formState.errors.password.message}</p>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        <Button className="mt-1 bg-slate-950 hover:bg-slate-800" disabled={form.formState.isSubmitting} type="submit">
          {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <LogIn />}
          Sign in
        </Button>
      </form>

      <Button asChild type="button" variant="secondary">
        <Link href="/login">
          <Building2 />
          Hotel login
        </Link>
      </Button>
    </div>
  );
}

function readJwtName(token: string) {
  try {
    const payload = JSON.parse(window.atob(token.split(".")[1] ?? "")) as { name?: string };
    return payload.name ?? null;
  } catch {
    return null;
  }
}
