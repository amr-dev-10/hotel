import { StaffPage } from "@/features/staff/components/staff-page";

export default async function StaffRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <StaffPage hotelId={hotelId} />;
}
