import { RoleEditorPage } from "@/features/roles/components/role-editor-page";

export default async function RoleDetailRoute({
  params,
}: {
  params: Promise<{ hotelId: string; roleId: string }>;
}) {
  const { hotelId, roleId } = await params;

  return <RoleEditorPage hotelId={hotelId} roleId={roleId} />;
}
