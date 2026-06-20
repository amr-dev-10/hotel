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
import { useDepartments } from "@/features/departments/hooks/useDepartments";
import { useCreateTaskSla, useTaskSlas } from "@/features/workflow/hooks/useWorkflowSettings";

export function TaskSlasPage({ hotelId }: { hotelId: string }) {
  const departments = useDepartments(hotelId);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const departmentId = selectedDepartment || departments.data?.[0]?.id || "";
  const slas = useTaskSlas(hotelId, departmentId);
  const createSla = useCreateTaskSla(hotelId, departmentId);
  const [category, setCategory] = useState("");
  const [slaMinutes, setSlaMinutes] = useState(30);
  const [acceptMinutes, setAcceptMinutes] = useState(2);
  const [description, setDescription] = useState("");

  async function handleCreate() {
    try {
      await createSla.mutateAsync({
        task_category: category,
        sla_minutes: slaMinutes,
        accept_timeout_minutes: acceptMinutes,
        description: description || null,
        is_active: true,
      });
      setCategory("");
      setDescription("");
      toast.success("Task SLA created");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  if (departments.isLoading) {
    return <DataState isLoading />;
  }

  if (departments.error) {
    return <DataState error={departments.error} />;
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Button asChild type="button" variant="ghost">
            <Link href={`/${hotelId}/settings/workflow`}>
              <ArrowLeft />
              Workflow
            </Link>
          </Button>
          <h2 className="mt-2 text-xl font-semibold">Task SLAs</h2>
        </div>
        <div className="w-full sm:w-72">
          <Select value={departmentId} onChange={(event) => setSelectedDepartment(event.target.value)}>
            {(departments.data ?? []).map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-[1fr_140px_140px_1fr_auto] md:items-end">
        <Field label="Task category" id="sla-category">
          <Input id="sla-category" value={category} onChange={(event) => setCategory(event.target.value)} />
        </Field>
        <Field label="SLA minutes" id="sla-minutes">
          <Input id="sla-minutes" min={1} type="number" value={slaMinutes} onChange={(event) => setSlaMinutes(Number(event.target.value))} />
        </Field>
        <Field label="Accept min" id="sla-accept">
          <Input id="sla-accept" min={1} type="number" value={acceptMinutes} onChange={(event) => setAcceptMinutes(Number(event.target.value))} />
        </Field>
        <Field label="Description" id="sla-description">
          <Input id="sla-description" value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <Button disabled={createSla.isPending || category.length < 2 || !departmentId} type="button" onClick={handleCreate}>
          {createSla.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          Add
        </Button>
      </section>

      {slas.isLoading ? <DataState isLoading /> : null}
      {slas.error ? <DataState error={slas.error} /> : null}
      {!slas.isLoading && !slas.data?.length ? <DataState empty emptyTitle="No SLAs for this department." /> : null}
      {slas.data?.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {slas.data.map((sla) => (
            <div className="rounded-md border border-slate-200 bg-white p-4" key={sla.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{sla.task_category}</h3>
                  <p className="text-sm text-slate-500">{sla.description ?? "No description"}</p>
                </div>
                <Badge variant={sla.is_active ? "green" : "default"}>{sla.sla_minutes} min</Badge>
              </div>
              <p className="mt-3 text-sm text-slate-600">Accept timeout: {sla.accept_timeout_minutes} min</p>
            </div>
          ))}
        </div>
      ) : null}
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
