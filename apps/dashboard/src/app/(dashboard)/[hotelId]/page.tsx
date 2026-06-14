import { redirect } from "next/navigation";

export default async function HotelHomePage({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  redirect(`/${hotelId}/overview`);
}
