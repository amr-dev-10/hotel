import { StaffProfilePage } from "@/features/staff/components/staff-profile-page";

export default async function StaffProfileRoute({
  params,
}: {
  params: Promise<{ hotelId: string; staffId: string }>;
}) {
  const { hotelId, staffId } = await params;

  return <StaffProfilePage hotelId={hotelId} staffId={staffId} />;
}
