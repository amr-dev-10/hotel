import { StaffWorkloadPage } from "@/features/staff/components/staff-workload-page";

export default async function StaffWorkloadRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <StaffWorkloadPage hotelId={hotelId} />;
}
