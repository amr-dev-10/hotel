import { HousekeepingPage } from "@/features/housekeeping/components/housekeeping-page";

export default async function HousekeepingRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <HousekeepingPage hotelId={hotelId} />;
}
