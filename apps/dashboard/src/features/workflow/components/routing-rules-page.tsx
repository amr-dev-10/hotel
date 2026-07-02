"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { showApiErrorToast } from "@/lib/api/error-toast";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { titleCase } from "@/lib/utils";
import {
  useCreateRoutingRule,
  useDeleteRoutingRule,
  useRoutingRules,
  useUpdateRoutingRule,
} from "@/features/workflow/hooks/useWorkflowSettings";
import type { RoutingRule } from "@/types/domain";

const CHANNEL_OPTIONS = [
  { value: "fcm", label: "Mobile push" },
  { value: "websocket", label: "In-app" },
  { value: "whatsapp", label: "WhatsApp" },
];

export function RoutingRulesPage({ hotelId }: { hotelId: string }) {
  const rules = useRoutingRules(hotelId);
  const createRule = useCreateRoutingRule(hotelId);
  const updateRule = useUpdateRoutingRule(hotelId);
  const deleteRule = useDeleteRoutingRule(hotelId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ticketType, setTicketType] = useState("Complaint");
  const [targetLevel, setTargetLevel] = useState("manager");
  const [priority, setPriority] = useState(4);
  const [skipNormalAssignment, setSkipNormalAssignment] = useState(true);
  const [notifyImmediately, setNotifyImmediately] = useState(true);
  const [notificationChannels, setNotificationChannels] = useState(["fcm", "websocket", "whatsapp"]);

  async function handleSave() {
    const channels = notifyImmediately ? notificationChannels.length ? notificationChannels : ["websocket"] : [];
    const payload = {
      ticket_type: ticketType,
      target_staff_level: targetLevel || null,
      target_user_id: null,
      skip_normal_assignment: skipNormalAssignment,
      priority_override: priority,
      notify_immediately: notifyImmediately,
      notification_channels: channels,
      is_active: true,
    };
    try {
      if (editingId) {
        await updateRule.mutateAsync({ ruleId: editingId, payload });
        toast.success("Routing rule updated");
      } else {
        await createRule.mutateAsync(payload);
        toast.success("Routing rule created");
      }
      clearForm();
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  async function handleDelete(ruleId: string) {
    try {
      await deleteRule.mutateAsync(ruleId);
      if (editingId === ruleId) {
        clearForm();
      }
      toast.success("Routing rule deleted");
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  function editRule(rule: RoutingRule) {
    setEditingId(rule.id);
    setTicketType(rule.ticket_type);
    setTargetLevel(rule.target_staff_level ?? "manager");
    setPriority(rule.priority_override ?? 4);
    setSkipNormalAssignment(rule.skip_normal_assignment);
    setNotifyImmediately(rule.notify_immediately);
    setNotificationChannels(rule.notification_channels.length ? rule.notification_channels : ["websocket"]);
  }

  function clearForm() {
    setEditingId(null);
    setTicketType("Complaint");
    setTargetLevel("manager");
    setPriority(4);
    setSkipNormalAssignment(true);
    setNotifyImmediately(true);
    setNotificationChannels(["fcm", "websocket", "whatsapp"]);
  }

  function toggleChannel(channel: string) {
    setNotificationChannels((current) =>
      current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel],
    );
  }

  if (rules.isLoading) {
    return <DataState isLoading />;
  }

  if (rules.error) {
    return <DataState error={rules.error} />;
  }

  return (
    <div className="grid gap-5">
      <PageBreadcrumbs
        current="Routing Rules"
        hotelId={hotelId}
        items={[
          { label: "Settings" },
          { label: "Workflow", href: `/${hotelId}/settings/workflow` },
        ]}
      />

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-3">
        <Field label="Ticket type" id="route-ticket-type">
          <Input id="route-ticket-type" value={ticketType} onChange={(event) => setTicketType(event.target.value)} />
        </Field>
        <Field label="Target level" id="route-target">
          <Select id="route-target" value={targetLevel} onChange={(event) => setTargetLevel(event.target.value)}>
            <option value="supervisor">Supervisor</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </Select>
        </Field>
        <Field label="Priority" id="route-priority">
          <Input id="route-priority" max={5} min={1} type="number" value={priority} onChange={(event) => setPriority(Number(event.target.value))} />
        </Field>
        <Field label="Assignment" id="route-assignment">
          <Select id="route-assignment" value={skipNormalAssignment ? "skip" : "normal"} onChange={(event) => setSkipNormalAssignment(event.target.value === "skip")}>
            <option value="skip">Skip normal assignment</option>
            <option value="normal">Use normal assignment</option>
          </Select>
        </Field>
        <Field label="Notify" id="route-notify">
          <Select id="route-notify" value={notifyImmediately ? "yes" : "no"} onChange={(event) => setNotifyImmediately(event.target.value === "yes")}>
            <option value="yes">Notify immediately</option>
            <option value="no">Do not notify</option>
          </Select>
        </Field>
        <Field label="Channels" id="route-channels">
          <div className="flex min-h-9 flex-wrap items-center gap-2">
            {CHANNEL_OPTIONS.map((channel) => (
              <label className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700" key={channel.value}>
                <input
                  checked={notificationChannels.includes(channel.value)}
                  className="size-3 accent-[var(--primary)]"
                  disabled={!notifyImmediately}
                  type="checkbox"
                  onChange={() => toggleChannel(channel.value)}
                />
                {channel.label}
              </label>
            ))}
          </div>
        </Field>
        <div className="md:col-span-3">
          <div className="flex flex-wrap gap-2">
            <Button disabled={createRule.isPending || updateRule.isPending || ticketType.length < 2} type="button" onClick={handleSave}>
              {createRule.isPending || updateRule.isPending ? <Loader2 className="animate-spin" /> : editingId ? <Pencil /> : <Plus />}
              {editingId ? "Update rule" : "Add rule"}
            </Button>
            {editingId ? (
              <Button type="button" variant="secondary" onClick={clearForm}>
                <X />
                Cancel edit
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {!rules.data?.length ? (
        <DataState empty emptyTitle="No routing rules yet." />
      ) : (
        <div className="grid gap-3">
          {rules.data.map((rule) => (
            <div className="rounded-md border border-slate-200 bg-white p-4" key={rule.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{rule.ticket_type}</h3>
                  <p className="text-sm text-slate-500">
                    Route to {titleCase(rule.target_staff_level)} {rule.skip_normal_assignment ? "immediately" : "normally"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Badge variant={rule.is_active ? "green" : "default"}>
                    {rule.priority_override ? `P${rule.priority_override}` : "No override"}
                  </Badge>
                  <Button size="sm" type="button" variant="secondary" onClick={() => editRule(rule)}>
                    <Pencil />
                    Edit
                  </Button>
                  <Button disabled={deleteRule.isPending} size="sm" type="button" variant="secondary" onClick={() => handleDelete(rule.id)}>
                    {deleteRule.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
                    Delete
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {rule.notify_immediately ? `Notify via ${rule.notification_channels.join(", ")}` : "No immediate notification"}
              </p>
            </div>
          ))}
        </div>
      )}
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
