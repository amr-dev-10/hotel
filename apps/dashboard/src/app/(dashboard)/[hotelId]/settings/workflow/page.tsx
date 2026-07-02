import { WorkflowOverviewPage } from "@/features/workflow/components/workflow-overview-page";

export default async function WorkflowRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <WorkflowOverviewPage hotelId={hotelId} />;
}
