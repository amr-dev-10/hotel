import { StaffProfilePage } from "@/features/staff/components/staff-profile-page";

export default async function StaffAttendanceDetailRoute({
  params,
}: {
  params: Promise<{ hotelId: string; staffId: string }>;
}) {
  const { hotelId, staffId } = await params;

  return <StaffProfilePage defaultTab="attendance" hotelId={hotelId} staffId={staffId} />;
}
