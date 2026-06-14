import { HierarchyPage } from "@/features/hierarchy/components/hierarchy-page";

export default async function HierarchyRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <HierarchyPage hotelId={hotelId} />;
}
