import { WhatsAppTemplatesPage } from "@/features/whatsapp/components/whatsapp-templates-page";

export default async function WhatsAppTemplatesRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <WhatsAppTemplatesPage hotelId={hotelId} />;
}
