"use client";

import Link from "next/link";
import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { titleCase } from "@/lib/utils";
import { useEscalationRules, useRoutingRules, useWorkflows } from "@/features/workflow/hooks/useWorkflowSettings";

export function WorkflowOverviewPage({ hotelId }: { hotelId: string }) {
  const workflows = useWorkflows(hotelId);
  const escalationRules = useEscalationRules(hotelId);
  const routingRules = useRoutingRules(hotelId);
  const graph = buildEscalationGraph(escalationRules.data ?? []);

  if (workflows.isLoading || escalationRules.isLoading || routingRules.isLoading) {
    return <DataState isLoading />;
  }

  if (workflows.error || escalationRules.error || routingRules.error) {
    return <DataState error={workflows.error ?? escalationRules.error ?? routingRules.error} />;
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Workflow Settings</h2>
          <p className="text-sm text-slate-500">Ticket workflows, escalation timers, SLAs, and routing rules.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild type="button" variant="secondary">
            <Link href={`/${hotelId}/settings/workflow/escalation-rules`}>Escalations</Link>
          </Button>
          <Button asChild type="button" variant="secondary">
            <Link href={`/${hotelId}/settings/workflow/task-slas`}>SLAs</Link>
          </Button>
          <Button asChild type="button">
            <Link href={`/${hotelId}/settings/workflow/routing-rules`}>Routing</Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Workflows" value={workflows.data?.length ?? 0} />
        <Metric label="Escalation rules" value={escalationRules.data?.length ?? 0} />
        <Metric label="Routing rules" value={routingRules.data?.length ?? 0} />
      </section>

      <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold">Escalation Path</h3>
        {graph.nodes.length ? (
          <div className="h-[420px] overflow-hidden rounded-md border border-slate-200">
            <ReactFlow edges={graph.edges} fitView nodes={graph.nodes} nodesDraggable={false}>
              <Background color="#d8e0eb" gap={18} />
              <Controls />
            </ReactFlow>
          </div>
        ) : (
          <DataState empty emptyTitle="No escalation rules configured yet." />
        )}
      </section>

      <section className="grid gap-3">
        {(workflows.data ?? []).map((workflow) => (
          <div className="rounded-md border border-slate-200 bg-white p-4" key={workflow.id}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">{workflow.name}</h3>
                <p className="text-sm text-slate-500">{titleCase(workflow.entity_type)}</p>
              </div>
              <Badge variant={workflow.is_active ? "green" : "default"}>
                {workflow.is_default ? "Default" : "Custom"}
              </Badge>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function buildEscalationGraph(rules: { id: string; escalation_level: number; trigger_after_minutes: number; target_staff_level: string | null }[]) {
  const sorted = rules.slice().sort((a, b) => a.escalation_level - b.escalation_level);
  const nodes: Node[] = sorted.map((rule, index) => ({
    id: rule.id,
    position: { x: index * 240, y: index % 2 === 0 ? 0 : 120 },
    data: {
      label: `Level ${rule.escalation_level}: ${rule.target_staff_level ?? "next staff"} ${rule.trigger_after_minutes}m after due`,
    },
    style: { borderColor: "#0F3D91", borderRadius: 6, fontSize: 12 },
  }));
  const edges: Edge[] = sorted.slice(1).map((rule, index) => ({
    id: `${sorted[index].id}-${rule.id}`,
    source: sorted[index].id,
    target: rule.id,
  }));
  return { nodes, edges };
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
