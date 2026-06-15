import { GuestsPage } from "@/features/guests/components/guests-page";

export default async function GuestsRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <GuestsPage hotelId={hotelId} />;
}
