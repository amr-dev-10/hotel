"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { showApiErrorToast } from "@/lib/api/error-toast";
import { titleCase } from "@/lib/utils";
import {
  useCreateWhatsappTemplate,
  useSyncWhatsappTemplates,
  useWhatsappTemplates,
} from "@/features/whatsapp/hooks/useWhatsapp";

export function WhatsAppTemplatesPage({ hotelId }: { hotelId: string }) {
  const templates = useWhatsappTemplates(hotelId);
  const createTemplate = useCreateWhatsappTemplate(hotelId);
  const syncTemplates = useSyncWhatsappTemplates(hotelId);
  const [name, setName] = useState("");
  const [type, setType] = useState("promotional");
  const [language, setLanguage] = useState("en");

  async function handleCreate() {
    try {
      await createTemplate.mutateAsync({
        template_name: name,
        template_type: type,
        language,
        status: "pending",
        header_params: [],
        body_params: [],
      });
      setName("");
      toast.success("Template created");
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  async function handleSync() {
    try {
      await syncTemplates.mutateAsync();
      toast.success("Templates synced");
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  if (templates.isLoading) {
    return <DataState isLoading />;
  }

  if (templates.error) {
    return <DataState error={templates.error} />;
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Button asChild type="button" variant="ghost">
            <Link href={`/${hotelId}/whatsapp`}>
              <ArrowLeft />
              Inbox
            </Link>
          </Button>
          <h2 className="mt-2 text-xl font-semibold">WhatsApp Templates</h2>
        </div>
        <Button disabled={syncTemplates.isPending} type="button" variant="secondary" onClick={handleSync}>
          {syncTemplates.isPending ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
          Sync
        </Button>
      </div>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-[1fr_180px_140px_auto] md:items-end">
        <div className="grid gap-2">
          <Label htmlFor="template-name">Template name</Label>
          <Input id="template-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="template-type">Type</Label>
          <Select id="template-type" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="promotional">Promotional</option>
            <option value="utility">Utility</option>
            <option value="transactional">Transactional</option>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="template-language">Language</Label>
          <Input id="template-language" value={language} onChange={(event) => setLanguage(event.target.value)} />
        </div>
        <Button disabled={createTemplate.isPending || name.length < 2} type="button" onClick={handleCreate}>
          {createTemplate.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          Add
        </Button>
      </section>

      {!templates.data?.length ? (
        <DataState empty emptyTitle="No WhatsApp templates yet." />
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="grid grid-cols-[1fr_140px_120px_120px] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-normal text-slate-500">
            <span>Name</span>
            <span>Type</span>
            <span>Language</span>
            <span>Status</span>
          </div>
          {templates.data.map((template) => (
            <div className="grid grid-cols-[1fr_140px_120px_120px] border-t border-slate-100 px-4 py-3 text-sm" key={template.id}>
              <span className="truncate font-medium">{template.template_name}</span>
              <span>{titleCase(template.template_type)}</span>
              <span>{template.language}</span>
              <Badge variant={template.status === "approved" ? "green" : "amber"}>{titleCase(template.status)}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
