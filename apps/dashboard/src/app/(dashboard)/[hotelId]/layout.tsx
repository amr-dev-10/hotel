import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function HotelLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <DashboardShell hotelId={hotelId}>{children}</DashboardShell>;
}
