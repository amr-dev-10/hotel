import { StaffProfilePage } from "@/features/staff/components/staff-profile-page";

export default async function StaffTicketsRoute({
  params,
}: {
  params: Promise<{ hotelId: string; staffId: string }>;
}) {
  const { hotelId, staffId } = await params;

  return <StaffProfilePage defaultTab="tickets" hotelId={hotelId} staffId={staffId} />;
}
