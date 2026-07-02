import { RoleEditorPage } from "@/features/roles/components/role-editor-page";

export default async function NewRoleRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <RoleEditorPage hotelId={hotelId} />;
}
