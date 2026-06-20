"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiErrorMessage } from "@/lib/api/client";
import { titleCase } from "@/lib/utils";
import { useCreateRoutingRule, useRoutingRules } from "@/features/workflow/hooks/useWorkflowSettings";

export function RoutingRulesPage({ hotelId }: { hotelId: string }) {
  const rules = useRoutingRules(hotelId);
  const createRule = useCreateRoutingRule(hotelId);
  const [ticketType, setTicketType] = useState("Complaint");
  const [targetLevel, setTargetLevel] = useState("manager");
  const [priority, setPriority] = useState(4);

  async function handleCreate() {
    try {
      await createRule.mutateAsync({
        ticket_type: ticketType,
        target_staff_level: targetLevel,
        target_user_id: null,
        skip_normal_assignment: true,
        priority_override: priority,
        notify_immediately: true,
        notification_channels: ["fcm", "websocket", "whatsapp"],
        is_active: true,
      });
      toast.success("Routing rule created");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  if (rules.isLoading) {
    return <DataState isLoading />;
  }

  if (rules.error) {
    return <DataState error={rules.error} />;
  }

  return (
    <div className="grid gap-5">
      <div>
        <Button asChild type="button" variant="ghost">
          <Link href={`/${hotelId}/settings/workflow`}>
            <ArrowLeft />
            Workflow
          </Link>
        </Button>
        <h2 className="mt-2 text-xl font-semibold">Routing Rules</h2>
      </div>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-[1fr_180px_140px_auto] md:items-end">
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
        <Button disabled={createRule.isPending || ticketType.length < 2} type="button" onClick={handleCreate}>
          {createRule.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          Add
        </Button>
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
                <Badge variant={rule.is_active ? "green" : "default"}>
                  {rule.priority_override ? `P${rule.priority_override}` : "No override"}
                </Badge>
              </div>
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
