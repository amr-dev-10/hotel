"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Loader2, RotateCcw, Save, TestTube2 } from "lucide-react";
import { toast } from "sonner";
import { showApiErrorToast } from "@/lib/api/error-toast";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  const [isActive, setIsActive] = useState(false);
  const [temperature, setTemperature] = useState(0.3);
  const [highConfidenceThreshold, setHighConfidenceThreshold] = useState(0.95);
  const [lowConfidenceThreshold, setLowConfidenceThreshold] = useState(0.8);
  const [maxContextMessages, setMaxContextMessages] = useState(20);
  const [language, setLanguage] = useState("en");
  const [enableTicketCreation, setEnableTicketCreation] = useState(true);
  const [enableAutoReply, setEnableAutoReply] = useState(false);
  const [enableSentimentAnalysis, setEnableSentimentAnalysis] = useState(true);
  const [escalationDepartmentKey, setEscalationDepartmentKey] = useState("front_office");
  const [systemPrompt, setSystemPrompt] = useState("");

  useEffect(() => {
    if (!settings.data) {
      return;
    }

    setProvider(settings.data.provider);
    setModel(settings.data.model ?? "");
    setEmbeddingProvider(settings.data.embedding_provider ?? "");
    setEmbeddingModel(settings.data.embedding_model ?? "");
    setIsActive(settings.data.is_active);
    setTemperature(settings.data.temperature);
    setHighConfidenceThreshold(settings.data.high_confidence_threshold);
    setLowConfidenceThreshold(settings.data.low_confidence_threshold);
    setMaxContextMessages(settings.data.max_context_messages);
    setLanguage(settings.data.language);
    setEnableTicketCreation(settings.data.enable_ticket_creation);
    setEnableAutoReply(settings.data.enable_auto_reply);
    setEnableSentimentAnalysis(settings.data.enable_sentiment_analysis);
    setEscalationDepartmentKey(settings.data.escalation_department_key);
    setSystemPrompt(settings.data.system_prompt ?? "");
  }, [settings.data]);

  async function handleSave() {
    try {
      await saveSettings.mutateAsync({
        provider,
        api_key: apiKey || null,
        model: model || null,
        embedding_provider: embeddingProvider || null,
        embedding_model: embeddingModel || null,
        is_active: isActive,
        temperature,
        high_confidence_threshold: highConfidenceThreshold,
        low_confidence_threshold: lowConfidenceThreshold,
        max_context_messages: maxContextMessages,
        language,
        enable_ticket_creation: enableTicketCreation,
        enable_auto_reply: enableAutoReply,
        enable_sentiment_analysis: enableSentimentAnalysis,
        escalation_department_key: escalationDepartmentKey,
        system_prompt: systemPrompt || null,
      });
      setApiKey("");
      toast.success("AI settings saved");
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  async function handleTest() {
    try {
      const result = await testConnection.mutateAsync();
      toast.success(result.response_preview || "AI provider responded");
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  async function handleReset() {
    try {
      await resetSettings.mutateAsync();
      toast.success("AI settings reset");
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  if (settings.isLoading) {
    return <DataState isLoading />;
  }

  if (settings.error) {
    return <DataState error={settings.error} />;
  }

  const busy = saveSettings.isPending || testConnection.isPending || resetSettings.isPending;
  const modelPlaceholder =
    provider === "groq"
      ? "llama-3.3-70b-versatile"
      : provider === "anthropic"
        ? "claude-3-5-sonnet-latest"
        : provider === "gemini"
          ? "gemini-2.0-flash"
          : provider === "local"
            ? "local-keyword"
            : "gpt-4o-mini";

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <PageBreadcrumbs
          current="AI Configuration"
          description="Provider, model, and connection status."
          hotelId={hotelId}
          items={[{ label: "AI Provider", href: `/${hotelId}/ai` }]}
        />
        <Button asChild type="button" variant="secondary">
          <Link href={`/${hotelId}/ai`}>Dashboard</Link>
        </Button>
      </div>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
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
              <option value="local">Local fallback</option>
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="groq">Groq</option>
            </Select>
          </Field>
          <Field label="Model" id="ai-model">
            <Input id="ai-model" placeholder={modelPlaceholder} value={model} onChange={(event) => setModel(event.target.value)} />
          </Field>
          <Field label="API key" id="ai-key">
            <PasswordInput
              id="ai-key"
              placeholder="Write-only key"
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
          <Field label="Language" id="ai-language">
            <Input id="ai-language" value={language} onChange={(event) => setLanguage(event.target.value)} />
          </Field>
          <Field label="Escalation department" id="ai-escalation-department">
            <Input
              id="ai-escalation-department"
              value={escalationDepartmentKey}
              onChange={(event) => setEscalationDepartmentKey(event.target.value)}
            />
          </Field>
          <Field label="Context messages" id="ai-context-messages">
            <Input
              id="ai-context-messages"
              min={1}
              max={100}
              type="number"
              value={maxContextMessages}
              onChange={(event) => setMaxContextMessages(Number(event.target.value))}
            />
          </Field>
          <Field label="Temperature" id="ai-temperature">
            <Input
              id="ai-temperature"
              max={2}
              min={0}
              step={0.1}
              type="number"
              value={temperature}
              onChange={(event) => setTemperature(Number(event.target.value))}
            />
          </Field>
          <Field label="High confidence" id="ai-high-confidence">
            <Input
              id="ai-high-confidence"
              max={1}
              min={0}
              step={0.01}
              type="number"
              value={highConfidenceThreshold}
              onChange={(event) => setHighConfidenceThreshold(Number(event.target.value))}
            />
          </Field>
          <Field label="Low confidence" id="ai-low-confidence">
            <Input
              id="ai-low-confidence"
              max={1}
              min={0}
              step={0.01}
              type="number"
              value={lowConfidenceThreshold}
              onChange={(event) => setLowConfidenceThreshold(Number(event.target.value))}
            />
          </Field>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <ToggleField
            checked={isActive}
            id="ai-is-active"
            label="Enable AI runtime"
            onChange={setIsActive}
          />
          <ToggleField
            checked={enableTicketCreation}
            id="ai-ticket-creation"
            label="Create tickets"
            onChange={setEnableTicketCreation}
          />
          <ToggleField
            checked={enableAutoReply}
            id="ai-auto-reply"
            label="Auto-send replies"
            onChange={setEnableAutoReply}
          />
          <ToggleField
            checked={enableSentimentAnalysis}
            id="ai-sentiment"
            label="Sentiment analysis"
            onChange={setEnableSentimentAnalysis}
          />
        </div>

        <Field label="System prompt" id="ai-system-prompt">
          <Textarea
            id="ai-system-prompt"
            value={systemPrompt}
            onChange={(event) => setSystemPrompt(event.target.value)}
          />
        </Field>

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

function ToggleField({
  checked,
  id,
  label,
  onChange,
}: {
  checked: boolean;
  id: string;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
      htmlFor={id}
    >
      <span className="font-medium text-slate-700">{label}</span>
      <input
        checked={checked}
        className="size-4 accent-[var(--primary)]"
        id={id}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
