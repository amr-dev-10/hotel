"use client";

import { CreateStaffDialog } from "@/features/staff/components/create-staff-dialog";
import { StaffDirectory } from "@/features/staff/components/staff-directory";

export function StaffPage({ hotelId }: { hotelId: string }) {
  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Staff Settings</h2>
          <p className="text-sm text-slate-500">View staff hierarchy signals and add operational users.</p>
        </div>
        <CreateStaffDialog hotelId={hotelId} />
      </div>
      <StaffDirectory hotelId={hotelId} />
    </div>
  );
}
