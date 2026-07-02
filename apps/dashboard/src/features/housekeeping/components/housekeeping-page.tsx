"use client";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { CreateHousekeepingDialog } from "@/features/housekeeping/components/create-housekeeping-dialog";
import { HousekeepingPlanner } from "@/features/housekeeping/components/housekeeping-planner";

export function HousekeepingPage({ hotelId }: { hotelId: string }) {
  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <PageBreadcrumbs
          current="Housekeeping"
          description="Schedule, assign, and close room tasks from one queue."
          hotelId={hotelId}
        />
        <CreateHousekeepingDialog hotelId={hotelId} />
      </div>
      <HousekeepingPlanner hotelId={hotelId} />
    </div>
  );
}
