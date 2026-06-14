import { RoutingRulesPage } from "@/features/workflow/components/routing-rules-page";

export default async function RoutingRulesRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <RoutingRulesPage hotelId={hotelId} />;
}
