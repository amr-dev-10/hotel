import { StaffProfilePage } from "@/features/staff/components/staff-profile-page";

export default async function StaffShiftsDetailRoute({
  params,
}: {
  params: Promise<{ hotelId: string; staffId: string }>;
}) {
  const { hotelId, staffId } = await params;

  return <StaffProfilePage defaultTab="shifts" hotelId={hotelId} staffId={staffId} />;
}
