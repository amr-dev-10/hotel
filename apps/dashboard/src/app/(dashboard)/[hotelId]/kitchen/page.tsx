import { KitchenPage } from "@/features/kitchen/components/kitchen-page";

export default async function KitchenRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <KitchenPage hotelId={hotelId} />;
}
