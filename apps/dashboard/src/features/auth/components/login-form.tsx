"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Loader2, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, apiErrorMessage } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth.store";
import type { ApiEnvelope, CurrentUser, TokenResponse } from "@/types/domain";
import { loginSchema, type LoginValues } from "@/features/auth/schemas/login.schema";

export function LoginForm() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
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

    try {
      const loginResponse = await api.post<ApiEnvelope<TokenResponse>>("/auth/login", values);
      const token = loginResponse.data.data.access_token;
      const meResponse = await api.get<ApiEnvelope<CurrentUser>>("/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setSession({
        token,
        refreshToken: loginResponse.data.data.refresh_token,
        currentUser: meResponse.data.data,
      });

      router.replace(`/${meResponse.data.data.hotel_id}/overview`);
    } catch (submitError) {
      setError(apiErrorMessage(submitError));
    }
  });

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-7 rounded-md border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-11 items-center justify-center rounded-md bg-[#0F3D91] text-white">
          <Building2 className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Arcadia Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your hotel operations workspace.</p>
        </div>
      </div>

      <form className="grid gap-4" onSubmit={onSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
          {form.formState.errors.email ? (
            <p className="text-xs text-rose-700">{form.formState.errors.email.message}</p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
          {form.formState.errors.password ? (
            <p className="text-xs text-rose-700">{form.formState.errors.password.message}</p>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        <Button className="mt-1" disabled={form.formState.isSubmitting} type="submit">
          {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <LogIn />}
          Sign in
        </Button>
      </form>
    </div>
  );
}
