import { StaffPortalPage } from "@/features/staff/components/staff-portal-page";

export default async function StaffPortalRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  return <StaffPortalPage hotelId={hotelId} />;
}
