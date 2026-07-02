import { TicketsPage } from "@/features/tickets/components/tickets-page";

export default async function TicketsRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <TicketsPage hotelId={hotelId} />;
}
