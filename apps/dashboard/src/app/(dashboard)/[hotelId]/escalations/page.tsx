import { EscalationsPage } from "@/features/escalations/components/escalations-page";

export default async function EscalationsRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <EscalationsPage hotelId={hotelId} />;
}
