import { OverviewDashboard } from "@/features/analytics/components/overview-dashboard";

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <OverviewDashboard hotelId={hotelId} />;
}
