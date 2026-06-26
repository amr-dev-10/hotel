"use client";

import { useParams } from "next/navigation";

export function useRouteHotelId(fallback?: string) {
  const params = useParams<{ hotelId?: string | string[] }>();
  const hotelId = fallback ?? params.hotelId;

  if (Array.isArray(hotelId)) {
    return hotelId[0] ?? "";
  }

  return hotelId ?? "";
}
