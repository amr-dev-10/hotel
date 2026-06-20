import { StaffProfilePage } from "@/features/staff/components/staff-profile-page";

export default async function StaffPerformanceRoute({
  params,
}: {
  params: Promise<{ hotelId: string; staffId: string }>;
}) {
  const { hotelId, staffId } = await params;

  return <StaffProfilePage defaultTab="performance" hotelId={hotelId} staffId={staffId} />;
}
