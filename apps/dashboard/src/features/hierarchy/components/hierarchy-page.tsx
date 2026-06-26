"use client";

import { useMemo, useState } from "react";
import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Badge } from "@/components/ui/badge";
import { DataState } from "@/components/ui/data-state";
import { Select } from "@/components/ui/select";
import { titleCase } from "@/lib/utils";
import { useDepartments } from "@/features/departments/hooks/useDepartments";
import { useDepartmentHierarchy } from "@/features/hierarchy/hooks/useDepartmentHierarchy";
import type { DepartmentHierarchy, DepartmentStaffNode } from "@/types/domain";

export function HierarchyPage({ hotelId }: { hotelId: string }) {
  const departments = useDepartments(hotelId);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const departmentId = selectedDepartment || departments.data?.[0]?.id || "";
  const hierarchy = useDepartmentHierarchy(hotelId, departmentId);
  const graph = useMemo(() => buildGraph(hierarchy.data), [hierarchy.data]);

  if (departments.isLoading) {
    return <DataState isLoading />;
  }

  if (departments.error) {
    return <DataState error={departments.error} />;
  }

  if (!departments.data?.length) {
    return <DataState empty emptyTitle="No departments configured yet." />;
  }

  const totalStaff =
    (hierarchy.data?.manager ? 1 : 0) +
    (hierarchy.data?.supervisors.length ?? 0) +
    (hierarchy.data?.attendants.length ?? 0) +
    (hierarchy.data?.supervisors.reduce((sum, supervisor) => sum + supervisor.attendants.length, 0) ?? 0);

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Staff Hierarchy</h2>
          <p className="text-sm text-slate-500">Department reporting tree and open-ticket load.</p>
        </div>
        <div className="w-full sm:w-72">
          <Select value={departmentId} onChange={(event) => setSelectedDepartment(event.target.value)}>
            {departments.data.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Total staff" value={totalStaff} />
        <Metric label="On shift" value={graph.onShift} />
        <Metric label="Open tickets" value={graph.openTickets} />
      </div>

      {hierarchy.isLoading ? <DataState isLoading /> : null}
      {hierarchy.error ? <DataState error={hierarchy.error} /> : null}
      {hierarchy.data && !graph.nodes.length ? (
        <DataState empty emptyTitle="No hierarchy records for this department." />
      ) : null}

      {graph.nodes.length ? (
        <section className="h-[640px] overflow-hidden rounded-md border border-slate-200 bg-white">
          <ReactFlow edges={graph.edges} fitView nodes={graph.nodes} nodesDraggable={false}>
            <Background color="#d8e0eb" gap={18} />
            <Controls />
          </ReactFlow>
        </section>
      ) : null}
    </div>
  );
}

function buildGraph(data?: DepartmentHierarchy) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let onShift = 0;
  let openTickets = 0;

  function addNode(node: DepartmentStaffNode, x: number, y: number, role: string) {
    onShift += node.on_shift ? 1 : 0;
    openTickets += node.open_tickets;
    nodes.push({
      id: node.id,
      position: { x, y },
      data: {
        label: (
          <div className="min-w-40 rounded-md border border-slate-200 bg-white p-3 text-left shadow-sm">
            <p className="text-sm font-semibold text-slate-950">{node.name}</p>
            <p className="text-xs text-slate-500">{titleCase(node.staff_level ?? role)}</p>
            <div className="mt-2 flex gap-2">
              <Badge variant={node.on_shift ? "green" : "default"}>{node.on_shift ? "On" : "Off"}</Badge>
              <Badge variant={node.open_tickets ? "amber" : "default"}>{node.open_tickets} open</Badge>
            </div>
          </div>
        ),
      },
      style: { border: 0, padding: 0, background: "transparent" },
    });
  }

  if (!data) {
    return { nodes, edges, onShift, openTickets };
  }

  const rootId = data.manager?.id ?? "department-root";
  if (data.manager) {
    addNode(data.manager, 0, 0, "manager");
  } else {
    nodes.push({
      id: rootId,
      position: { x: 0, y: 0 },
      data: { label: `${data.department} department` },
      style: { background: "#0F3D91", color: "white", border: 0 },
    });
  }

  data.supervisors.forEach((supervisor, index) => {
    const x = (index - (data.supervisors.length - 1) / 2) * 260;
    addNode(supervisor, x, 170, "supervisor");
    edges.push({ id: `${rootId}-${supervisor.id}`, source: rootId, target: supervisor.id });

    supervisor.attendants.forEach((attendant, attendantIndex) => {
      const childX = x + (attendantIndex - (supervisor.attendants.length - 1) / 2) * 190;
      addNode(attendant, childX, 350, "attendant");
      edges.push({ id: `${supervisor.id}-${attendant.id}`, source: supervisor.id, target: attendant.id });
    });
  });

  data.attendants.forEach((attendant, index) => {
    const x = (index - (data.attendants.length - 1) / 2) * 210;
    addNode(attendant, x, data.supervisors.length ? 520 : 220, "attendant");
    edges.push({ id: `${rootId}-${attendant.id}`, source: rootId, target: attendant.id });
  });

  return { nodes, edges, onShift, openTickets };
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
