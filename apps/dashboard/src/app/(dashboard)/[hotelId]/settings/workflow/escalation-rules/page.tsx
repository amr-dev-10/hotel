import { EscalationRulesPage } from "@/features/workflow/components/escalation-rules-page";

export default async function EscalationRulesRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <EscalationRulesPage hotelId={hotelId} />;
}
