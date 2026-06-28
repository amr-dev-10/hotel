"use client";

import Link from "next/link";
import { Bot, Settings, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { titleCase } from "@/lib/utils";
import { useAiAnalytics, useAiSettings } from "@/features/ai/hooks/useAiSettings";

export function AiDashboardPage({ hotelId }: { hotelId: string }) {
  const settings = useAiSettings(hotelId);
  const analytics = useAiAnalytics(hotelId);

  if (settings.isLoading || analytics.isLoading) {
    return <DataState isLoading />;
  }

  if (settings.error || analytics.error) {
    return <DataState error={settings.error ?? analytics.error} />;
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

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Requests" value={String(analytics.data?.total_requests ?? 0)} />
        <Metric label="Tokens" value={(analytics.data?.total_tokens ?? 0).toLocaleString()} />
        <Metric label="Escalations" value={`${Math.round((analytics.data?.escalation_rate ?? 0) * 100)}%`} />
        <Metric label="Auto Replies" value={`${Math.round((analytics.data?.auto_reply_rate ?? 0) * 100)}%`} />
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-semibold">Automation</h3>
            <p className="text-sm text-slate-500">Ticket creation, replies, and confidence thresholds.</p>
          </div>
          <Badge variant={settings.data?.is_active ? "green" : "amber"}>
            {settings.data?.is_active ? "Enabled" : "Disabled"}
          </Badge>
        </div>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
          <Status label="Create tickets" active={Boolean(settings.data?.enable_ticket_creation)} />
          <Status label="Auto reply" active={Boolean(settings.data?.enable_auto_reply)} />
          <Status label="Sentiment" active={Boolean(settings.data?.enable_sentiment_analysis)} />
        </div>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
          <p>
            <span className="text-slate-500">High confidence</span>
            <span className="ml-2 font-semibold">{Math.round((settings.data?.high_confidence_threshold ?? 0) * 100)}%</span>
          </p>
          <p>
            <span className="text-slate-500">Low confidence</span>
            <span className="ml-2 font-semibold">{Math.round((settings.data?.low_confidence_threshold ?? 0) * 100)}%</span>
          </p>
          <p>
            <span className="text-slate-500">Context messages</span>
            <span className="ml-2 font-semibold">{settings.data?.max_context_messages ?? 20}</span>
          </p>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Status({ label, active }: { label: string; active: boolean }) {
  return (
    <p className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
      <span>{label}</span>
      <Badge variant={active ? "green" : "amber"}>{active ? "On" : "Off"}</Badge>
    </p>
  );
}
