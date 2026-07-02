import { AiDashboardPage } from "@/features/ai/components/ai-dashboard-page";

export default async function AiRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <AiDashboardPage hotelId={hotelId} />;
}
