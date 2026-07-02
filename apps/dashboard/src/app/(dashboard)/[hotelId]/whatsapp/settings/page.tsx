import { WhatsAppSettingsPage } from "@/features/whatsapp/components/whatsapp-settings-page";

export default async function WhatsAppSettingsRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <WhatsAppSettingsPage hotelId={hotelId} />;
}
