"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Loader2, RotateCcw, Save, TestTube2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiErrorMessage } from "@/lib/api/client";
import { titleCase } from "@/lib/utils";
import {
  useAiSettings,
  useResetAiSettings,
  useSaveAiSettings,
  useTestAiConnection,
} from "@/features/ai/hooks/useAiSettings";

export function AiSettingsPage({ hotelId }: { hotelId: string }) {
  const settings = useAiSettings(hotelId);
  const saveSettings = useSaveAiSettings(hotelId);
  const testConnection = useTestAiConnection(hotelId);
  const resetSettings = useResetAiSettings(hotelId);
  const [provider, setProvider] = useState("gemini");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [embeddingProvider, setEmbeddingProvider] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("");

  useEffect(() => {
    if (!settings.data) {
      return;
    }

    setProvider(settings.data.provider);
    setModel(settings.data.model ?? "");
    setEmbeddingProvider(settings.data.embedding_provider ?? "");
    setEmbeddingModel(settings.data.embedding_model ?? "");
  }, [settings.data]);

  async function handleSave() {
    try {
      await saveSettings.mutateAsync({
        provider,
        api_key: apiKey || null,
        model: model || null,
        embedding_provider: embeddingProvider || null,
        embedding_model: embeddingModel || null,
      });
      setApiKey("");
      toast.success("AI settings saved");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  async function handleTest() {
    try {
      const result = await testConnection.mutateAsync();
      toast.success(result.response_preview || "AI provider responded");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  async function handleReset() {
    try {
      await resetSettings.mutateAsync();
      toast.success("AI settings reset");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  if (settings.isLoading) {
    return <DataState isLoading />;
  }

  if (settings.error) {
    return <DataState error={settings.error} />;
  }

  const busy = saveSettings.isPending || testConnection.isPending || resetSettings.isPending;

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">AI Configuration</h2>
          <p className="text-sm text-slate-500">Provider, model, and connection status.</p>
        </div>
        <Button asChild type="button" variant="secondary">
          <Link href={`/${hotelId}/ai`}>Dashboard</Link>
        </Button>
      </div>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-md bg-[#0F3D91]/10 text-[#0F3D91]">
              <Bot className="size-6" />
            </span>
            <div>
              <h3 className="text-base font-semibold">{titleCase(settings.data?.provider)}</h3>
              <p className="text-sm text-slate-500">{settings.data?.model ?? "No model selected"}</p>
            </div>
          </div>
          <Badge variant={settings.data?.status === "connected" ? "green" : "amber"}>
            {titleCase(settings.data?.status)}
          </Badge>
        </div>
      </section>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Provider" id="ai-provider">
            <Select id="ai-provider" value={provider} onChange={(event) => setProvider(event.target.value)}>
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic Claude</option>
            </Select>
          </Field>
          <Field label="Model" id="ai-model">
            <Input id="ai-model" placeholder="gpt-4o-mini" value={model} onChange={(event) => setModel(event.target.value)} />
          </Field>
          <Field label="API key" id="ai-key">
            <Input
              id="ai-key"
              placeholder="Write-only key"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </Field>
          <Field label="Embedding provider" id="ai-embedding-provider">
            <Input
              id="ai-embedding-provider"
              value={embeddingProvider}
              onChange={(event) => setEmbeddingProvider(event.target.value)}
            />
          </Field>
          <Field label="Embedding model" id="ai-embedding-model">
            <Input
              id="ai-embedding-model"
              value={embeddingModel}
              onChange={(event) => setEmbeddingModel(event.target.value)}
            />
          </Field>
        </div>

        {testConnection.data ? (
          <div className="rounded-md bg-slate-50 p-3 text-sm">
            <span className="font-semibold">{testConnection.data.response_time_ms}ms</span>
            <span className="ml-2 text-slate-600">{testConnection.data.response_preview}</span>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button disabled={busy} type="button" variant="secondary" onClick={handleReset}>
            {resetSettings.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
            Reset
          </Button>
          <Button disabled={busy} type="button" variant="secondary" onClick={handleTest}>
            {testConnection.isPending ? <Loader2 className="animate-spin" /> : <TestTube2 />}
            Test
          </Button>
          <Button disabled={busy} type="button" onClick={handleSave}>
            {saveSettings.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            Save
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
