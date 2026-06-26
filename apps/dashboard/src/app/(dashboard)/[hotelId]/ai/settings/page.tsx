import { AiSettingsPage } from "@/features/ai/components/ai-settings-page";

export default async function AiSettingsRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <AiSettingsPage hotelId={hotelId} />;
}
