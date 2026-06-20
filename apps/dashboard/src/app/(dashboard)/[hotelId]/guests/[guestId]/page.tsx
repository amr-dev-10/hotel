import { GuestProfilePage } from "@/features/guests/components/guest-profile-page";

export default async function GuestProfileRoute({
  params,
}: {
  params: Promise<{ hotelId: string; guestId: string }>;
}) {
  const { hotelId, guestId } = await params;

  return <GuestProfilePage guestId={guestId} hotelId={hotelId} />;
}
