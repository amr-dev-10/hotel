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
import { useDepartments } from "@/features/departments/hooks/useDepartments";
import { useCreateEscalationRule, useEscalationRules } from "@/features/workflow/hooks/useWorkflowSettings";

export function EscalationRulesPage({ hotelId }: { hotelId: string }) {
  const departments = useDepartments(hotelId);
  const rules = useEscalationRules(hotelId);
  const createRule = useCreateEscalationRule(hotelId);
  const [departmentId, setDepartmentId] = useState("");
  const [ticketType, setTicketType] = useState("Ticket");
  const [taskCategory, setTaskCategory] = useState("");
  const [level, setLevel] = useState(1);
  const [minutes, setMinutes] = useState(15);
  const [targetLevel, setTargetLevel] = useState("supervisor");

  async function handleCreate() {
    try {
      await createRule.mutateAsync({
        department_id: departmentId || null,
        ticket_type: ticketType || null,
        task_category: taskCategory || null,
        escalation_level: level,
        trigger_after_minutes: minutes,
        action: "escalate_up",
        target_staff_level: targetLevel || null,
        auto_reassign: true,
        send_notification: true,
        notification_channels: ["fcm", "websocket"],
        is_active: true,
      });
      toast.success("Escalation rule created");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  if (rules.isLoading || departments.isLoading) {
    return <DataState isLoading />;
  }

  if (rules.error || departments.error) {
    return <DataState error={rules.error ?? departments.error} />;
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
        <h2 className="mt-2 text-xl font-semibold">Escalation Rules</h2>
      </div>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-3">
        <Field label="Department" id="esc-department">
          <Select id="esc-department" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
            <option value="">Any department</option>
            {(departments.data ?? []).map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ticket type" id="esc-ticket-type">
          <Input id="esc-ticket-type" value={ticketType} onChange={(event) => setTicketType(event.target.value)} />
        </Field>
        <Field label="Task category" id="esc-task-category">
          <Input id="esc-task-category" value={taskCategory} onChange={(event) => setTaskCategory(event.target.value)} />
        </Field>
        <Field label="Level" id="esc-level">
          <Input id="esc-level" min={1} type="number" value={level} onChange={(event) => setLevel(Number(event.target.value))} />
        </Field>
        <Field label="After minutes" id="esc-minutes">
          <Input id="esc-minutes" min={0} type="number" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
        </Field>
        <Field label="Target level" id="esc-target">
          <Select id="esc-target" value={targetLevel} onChange={(event) => setTargetLevel(event.target.value)}>
            <option value="supervisor">Supervisor</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </Select>
        </Field>
        <div className="md:col-span-3">
          <Button disabled={createRule.isPending} type="button" onClick={handleCreate}>
            {createRule.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            Add rule
          </Button>
        </div>
      </section>

      {!rules.data?.length ? (
        <DataState empty emptyTitle="No escalation rules yet." />
      ) : (
        <div className="grid gap-3">
          {rules.data.map((rule) => (
            <div className="rounded-md border border-slate-200 bg-white p-4" key={rule.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Level {rule.escalation_level}</h3>
                  <p className="text-sm text-slate-500">
                    {titleCase(rule.ticket_type)} {rule.task_category ? `- ${rule.task_category}` : ""}
                  </p>
                </div>
                <Badge variant={rule.is_active ? "green" : "default"}>{rule.trigger_after_minutes} min</Badge>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {titleCase(rule.action)} to {titleCase(rule.target_staff_level)}
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
