import { ReservationDetailPage } from "@/features/reservations/components/reservation-detail-page";

export default async function ReservationDetailRoute({
  params,
}: {
  params: Promise<{ hotelId: string; reservationId: string }>;
}) {
  const { hotelId, reservationId } = await params;

  return <ReservationDetailPage hotelId={hotelId} reservationId={reservationId} />;
}
