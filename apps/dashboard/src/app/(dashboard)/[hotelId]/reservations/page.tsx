import { ReservationsPage } from "@/features/reservations/components/reservations-page";

export default async function ReservationsRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <ReservationsPage hotelId={hotelId} />;
}
