"use client";

import { CreateHousekeepingDialog } from "@/features/housekeeping/components/create-housekeeping-dialog";
import { HousekeepingPlanner } from "@/features/housekeeping/components/housekeeping-planner";

export function HousekeepingPage({ hotelId }: { hotelId: string }) {
  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Housekeeping</h2>
          <p className="text-sm text-slate-500">Schedule, assign, and close room tasks from one queue.</p>
        </div>
        <CreateHousekeepingDialog hotelId={hotelId} />
      </div>
      <HousekeepingPlanner hotelId={hotelId} />
    </div>
  );
}
