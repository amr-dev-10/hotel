import { RolesPage } from "@/features/roles/components/roles-page";

export default async function RolesRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <RolesPage hotelId={hotelId} />;
}
