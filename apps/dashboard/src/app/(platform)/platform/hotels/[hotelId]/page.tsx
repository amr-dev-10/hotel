import { PlatformHotelDetailPage } from "@/features/platform/components/platform-hotel-detail-page";

export default async function PlatformHotelDetailRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <PlatformHotelDetailPage hotelId={hotelId} />;
}
