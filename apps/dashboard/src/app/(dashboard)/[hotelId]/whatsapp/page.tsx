import { WhatsAppInboxPage } from "@/features/whatsapp/components/whatsapp-inbox-page";

export default async function WhatsAppRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <WhatsAppInboxPage hotelId={hotelId} />;
}
