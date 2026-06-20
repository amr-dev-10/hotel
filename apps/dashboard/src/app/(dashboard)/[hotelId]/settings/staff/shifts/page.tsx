import { StaffShiftsPage } from "@/features/staff/components/staff-shifts-page";

export default async function StaffShiftsRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <StaffShiftsPage hotelId={hotelId} />;
}
