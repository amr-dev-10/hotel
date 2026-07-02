import { TaskSlasPage } from "@/features/workflow/components/task-slas-page";

export default async function TaskSlasRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <TaskSlasPage hotelId={hotelId} />;
}
