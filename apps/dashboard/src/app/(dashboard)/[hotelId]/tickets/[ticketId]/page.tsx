import { TicketFullPage } from "@/features/tickets/components/ticket-full-page";

export default async function TicketDetailRoute({
  params,
}: {
  params: Promise<{ hotelId: string; ticketId: string }>;
}) {
  const { hotelId, ticketId } = await params;

  return <TicketFullPage hotelId={hotelId} ticketId={ticketId} />;
}
