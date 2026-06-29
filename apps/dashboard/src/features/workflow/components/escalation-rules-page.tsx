"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { showApiErrorToast } from "@/lib/api/error-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { titleCase } from "@/lib/utils";
import { useDepartments } from "@/features/departments/hooks/useDepartments";
import {
  useCreateEscalationRule,
  useDeleteEscalationRule,
  useEscalationRules,
  useResetEscalationRules,
  useTicketCategories,
  useUpdateEscalationRule,
} from "@/features/workflow/hooks/useWorkflowSettings";
import type { EscalationRule } from "@/types/domain";

export function EscalationRulesPage({ hotelId }: { hotelId: string }) {
  const departments = useDepartments(hotelId);
  const rules = useEscalationRules(hotelId);
  const categories = useTicketCategories(hotelId);
  const createRule = useCreateEscalationRule(hotelId);
  const updateRule = useUpdateEscalationRule(hotelId);
  const deleteRule = useDeleteEscalationRule(hotelId);
  const resetRules = useResetEscalationRules(hotelId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState("");
  const [ticketType, setTicketType] = useState("Ticket");
  const [categoryId, setCategoryId] = useState("");
  const [level, setLevel] = useState(1);
  const [minutes, setMinutes] = useState(0);
  const [targetLevel, setTargetLevel] = useState("supervisor");

  async function handleSave() {
    const selectedCategory = categories.data?.find((category) => category.id === categoryId);
    const payload = {
      department_id: (selectedCategory?.department_id ?? departmentId) || null,
      ticket_type: ticketType || null,
      task_category_id: selectedCategory?.id ?? null,
      task_category: selectedCategory?.key ?? null,
      escalation_level: level,
      trigger_after_minutes: minutes,
      action: "escalate_up",
      target_staff_level: targetLevel || null,
      auto_reassign: true,
      send_notification: true,
      notification_channels: ["fcm", "websocket"],
      is_active: true,
    };
    try {
      if (editingId) {
        await updateRule.mutateAsync({ ruleId: editingId, payload });
        toast.success("Escalation rule updated");
      } else {
        await createRule.mutateAsync(payload);
        toast.success("Escalation rule created");
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
      toast.success("Escalation rule deleted");
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  async function handleResetDefaults() {
    try {
      await resetRules.mutateAsync();
      clearForm();
      toast.success("Default escalation rules restored");
    } catch (error) {
      showApiErrorToast(error);
    }
  }

  function editRule(rule: EscalationRule) {
    setEditingId(rule.id);
    setDepartmentId(rule.department_id ?? "");
    setTicketType(rule.ticket_type ?? "");
    setCategoryId(rule.task_category_id ?? "");
    setLevel(rule.escalation_level);
    setMinutes(rule.trigger_after_minutes);
    setTargetLevel(rule.target_staff_level ?? "supervisor");
  }

  function clearForm() {
    setEditingId(null);
    setDepartmentId("");
    setTicketType("Ticket");
    setCategoryId("");
    setLevel(1);
    setMinutes(0);
    setTargetLevel("supervisor");
  }

  if (rules.isLoading || departments.isLoading || categories.isLoading) {
    return <DataState isLoading />;
  }

  if (rules.error || departments.error || categories.error) {
    return <DataState error={rules.error ?? departments.error ?? categories.error} />;
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
        <p className="mt-1 text-sm text-slate-500">Rules fire after the ticket SLA due time or after dispatch offer timeout.</p>
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
          <Select id="esc-task-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Any category</option>
            {(categories.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Level" id="esc-level">
          <Input id="esc-level" min={1} type="number" value={level} onChange={(event) => setLevel(Number(event.target.value))} />
        </Field>
        <Field label="Minutes after due" id="esc-minutes">
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
          <div className="flex flex-wrap gap-2">
            <Button disabled={createRule.isPending || updateRule.isPending} type="button" onClick={handleSave}>
              {createRule.isPending || updateRule.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              {editingId ? "Update rule" : "Add rule"}
            </Button>
            {editingId ? (
              <Button type="button" variant="secondary" onClick={clearForm}>
                Cancel edit
              </Button>
            ) : null}
            <Button disabled={resetRules.isPending} type="button" variant="secondary" onClick={handleResetDefaults}>
              {resetRules.isPending ? <Loader2 className="animate-spin" /> : null}
              Reset defaults
            </Button>
          </div>
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
                    {rule.ticket_type ? titleCase(rule.ticket_type) : "Any ticket"}{" "}
                    {rule.task_category_name ?? rule.task_category ? `- ${rule.task_category_name ?? rule.task_category}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={rule.is_active ? "green" : "default"}>{rule.trigger_after_minutes} min after due</Badge>
                  <Button size="sm" type="button" variant="secondary" onClick={() => editRule(rule)}>
                    Edit
                  </Button>
                  <Button size="sm" type="button" variant="secondary" onClick={() => handleDelete(rule.id)}>
                    Delete
                  </Button>
                </div>
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
