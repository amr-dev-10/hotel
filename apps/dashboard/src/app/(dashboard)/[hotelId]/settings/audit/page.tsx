import { AuditLogsPage } from "@/features/audit/components/audit-logs-page";

export default async function AuditLogsRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <AuditLogsPage hotelId={hotelId} />;
}
