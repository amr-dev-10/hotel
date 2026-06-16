import { RolesPage } from "@/features/roles/components/roles-page";

export default async function StaffRolesRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <RolesPage hotelId={hotelId} />;
}
