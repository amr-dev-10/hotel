import { StaffAttendancePage } from "@/features/staff/components/staff-attendance-page";

export default async function StaffAttendanceRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <StaffAttendancePage hotelId={hotelId} />;
}
