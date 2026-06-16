import { StaffProfilePage } from "@/features/staff/components/staff-profile-page";

export default async function StaffActivityRoute({
  params,
}: {
  params: Promise<{ hotelId: string; staffId: string }>;
}) {
  const { hotelId, staffId } = await params;

  return <StaffProfilePage defaultTab="activity" hotelId={hotelId} staffId={staffId} />;
}
