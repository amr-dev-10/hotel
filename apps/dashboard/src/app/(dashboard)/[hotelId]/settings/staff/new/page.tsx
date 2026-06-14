import { StaffCreatePage } from "@/features/staff/components/staff-create-page";

export default async function NewStaffRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <StaffCreatePage hotelId={hotelId} />;
}
