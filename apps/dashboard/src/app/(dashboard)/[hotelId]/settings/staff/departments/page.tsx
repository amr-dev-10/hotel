import { StaffDepartmentsPage } from "@/features/staff/components/staff-departments-page";

export default async function StaffDepartmentsRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <StaffDepartmentsPage hotelId={hotelId} />;
}
