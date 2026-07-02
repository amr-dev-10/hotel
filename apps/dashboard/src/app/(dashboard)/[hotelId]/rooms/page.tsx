import { RoomsPage } from "@/features/rooms/components/rooms-page";

export default async function RoomsRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <RoomsPage hotelId={hotelId} />;
}
