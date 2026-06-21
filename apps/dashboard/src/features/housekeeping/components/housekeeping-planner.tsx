"use client";

import { useMemo, useState } from "react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { CheckCircle2, Clock3, PlayCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { apiErrorMessage } from "@/lib/api/client";
import { compactId, titleCase } from "@/lib/utils";
import type { HousekeepingTask } from "@/types/domain";
import { useHousekeeping, useUpdateHousekeeping } from "@/features/housekeeping/hooks/useHousekeeping";
import { useRooms } from "@/features/rooms/hooks/useRooms";
import { useStaff } from "@/features/staff/hooks/useStaff";

export function HousekeepingPlanner({ hotelId }: { hotelId: string }) {
  const housekeeping = useHousekeeping(hotelId);
  const rooms = useRooms(hotelId);
  const staff = useStaff(hotelId);
  const updateTask = useUpdateHousekeeping(hotelId);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const roomMap = useMemo(
    () => new Map((rooms.data ?? []).map((room) => [room.id, room.room_number])),
    [rooms.data],
  );
  const staffMap = useMemo(
    () => new Map((staff.data ?? []).map((user) => [user.id, user.name])),
    [staff.data],
  );

  const events = useMemo(
    () =>
      (housekeeping.data ?? []).map((task) => ({
        id: task.id,
        title: `${roomMap.get(task.room_id) ?? compactId(task.room_id)} ${titleCase(task.task_type)}`,
        date: task.scheduled_date,
        backgroundColor: task.status === "completed" ? "#047857" : task.priority >= 4 ? "#BE123C" : "#0F3D91",
        borderColor: "transparent",
      })),
    [housekeeping.data, roomMap],
  );

  const selectedTask = housekeeping.data?.find((task) => task.id === selectedTaskId) ?? housekeeping.data?.[0];

  async function setStatus(
    task: HousekeepingTask,
    status: "pending" | "assigned" | "in_progress" | "completed" | "blocked",
  ) {
    try {
      await updateTask.mutateAsync({ taskId: task.id, payload: { status } });
      toast.success(`Task marked ${titleCase(status)}`);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }

  if (housekeeping.isLoading) {
    return <DataState isLoading />;
  }

  if (housekeeping.error) {
    return <DataState error={housekeeping.error} />;
  }

  if (!housekeeping.data?.length) {
    return <DataState empty emptyTitle="No housekeeping tasks scheduled." />;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <FullCalendar
          events={events}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek",
          }}
          height="auto"
          initialView="dayGridMonth"
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          eventClick={(event) => setSelectedTaskId(event.event.id)}
        />
      </section>

      <section className="grid content-start gap-4">
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Task Queue</h2>
              <p className="text-sm text-slate-500">Priority and assignment status</p>
            </div>
            <Badge variant="blue">{housekeeping.data.length}</Badge>
          </div>
          <div className="grid max-h-[420px] gap-3 overflow-y-auto pr-1">
            {housekeeping.data.map((task) => (
              <button
                className="rounded-md border border-slate-200 p-3 text-left transition-colors hover:bg-slate-50"
                key={task.id}
                type="button"
                onClick={() => setSelectedTaskId(task.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">
                      Room {roomMap.get(task.room_id) ?? compactId(task.room_id)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {titleCase(task.task_type)}
                      {task.assigned_to ? ` - ${staffMap.get(task.assigned_to) ?? compactId(task.assigned_to)}` : ""}
                    </p>
                  </div>
                  <Badge variant={taskStatusVariant(task.status)}>{titleCase(task.status)}</Badge>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {task.scheduled_date} {task.scheduled_time ?? ""}
                </p>
              </button>
            ))}
          </div>
        </div>

        {selectedTask ? (
          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-semibold">Selected Task</h3>
            <div className="mt-4 grid gap-3 text-sm">
              <Detail label="Room" value={roomMap.get(selectedTask.room_id) ?? compactId(selectedTask.room_id)} />
              <Detail label="Task" value={titleCase(selectedTask.task_type)} />
              <Detail label="Assigned" value={selectedTask.assigned_to ? staffMap.get(selectedTask.assigned_to) ?? compactId(selectedTask.assigned_to) : "Unassigned"} />
              <Detail label="Priority" value={`P${selectedTask.priority}`} />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Button size="sm" type="button" variant="secondary" onClick={() => setStatus(selectedTask, "assigned")}>
                <Clock3 />
                Assign
              </Button>
              <Button size="sm" type="button" variant="secondary" onClick={() => setStatus(selectedTask, "in_progress")}>
                <PlayCircle />
                Start
              </Button>
              <Button size="sm" type="button" onClick={() => setStatus(selectedTask, "completed")}>
                <CheckCircle2 />
                Done
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded bg-slate-50 px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function taskStatusVariant(status: string) {
  switch (status) {
    case "completed":
      return "green";
    case "in_progress":
      return "blue";
    case "blocked":
      return "rose";
    case "assigned":
      return "teal";
    default:
      return "amber";
  }
}
