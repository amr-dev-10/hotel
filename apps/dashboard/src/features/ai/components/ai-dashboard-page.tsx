"use client";

import Link from "next/link";
import { Bot, Settings, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { titleCase } from "@/lib/utils";
import { useAiSettings } from "@/features/ai/hooks/useAiSettings";

export function AiDashboardPage({ hotelId }: { hotelId: string }) {
  const settings = useAiSettings(hotelId);

  if (settings.isLoading) {
    return <DataState isLoading />;
  }

  if (settings.error) {
    return <DataState error={settings.error} />;
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">AI Provider</h2>
          <p className="text-sm text-slate-500">Current bot provider health for this hotel.</p>
        </div>
        <Button asChild type="button">
          <Link href={`/${hotelId}/ai/settings`}>
            <Settings />
            Configure
          </Link>
        </Button>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <Bot className="mb-3 size-5 text-[#0F3D91]" />
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Provider</p>
          <p className="mt-2 text-2xl font-semibold">{titleCase(settings.data?.provider)}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <Zap className="mb-3 size-5 text-[#0F3D91]" />
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Status</p>
          <div className="mt-2">
            <Badge variant={settings.data?.status === "connected" ? "green" : "amber"}>
              {titleCase(settings.data?.status)}
            </Badge>
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Model</p>
          <p className="mt-2 text-2xl font-semibold">{settings.data?.model ?? "Default"}</p>
        </div>
      </section>
    </div>
  );
}
