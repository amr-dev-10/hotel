import { WhatsAppConversationPage } from "@/features/whatsapp/components/whatsapp-conversation-page";

export default async function WhatsAppConversationRoute({
  params,
}: {
  params: Promise<{ hotelId: string; sessionId: string }>;
}) {
  const { hotelId, sessionId } = await params;

  return <WhatsAppConversationPage conversationId={sessionId} hotelId={hotelId} />;
}
