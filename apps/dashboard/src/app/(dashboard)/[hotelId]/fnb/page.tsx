import { FnBPage } from "@/features/fnb/components/fnb-page";

export default async function FnBRoute({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;

  return <FnBPage hotelId={hotelId} />;
}
