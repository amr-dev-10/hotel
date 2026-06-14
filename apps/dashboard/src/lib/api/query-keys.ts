export const queryKeys = {
  analytics: (hotelId: string, range: { from: string; to: string }) =>
    ["analytics", hotelId, range] as const,
  housekeeping: (hotelId: string) => ["housekeeping", hotelId] as const,
  reservations: (hotelId: string) => ["reservations", hotelId] as const,
  rooms: (hotelId: string) => ["rooms", hotelId] as const,
  staff: (hotelId: string) => ["staff", hotelId] as const,
  tickets: {
    all: (hotelId: string) => ["tickets", hotelId] as const,
    list: (hotelId: string, filters: Record<string, string>) =>
      ["tickets", hotelId, "list", filters] as const,
    acceptances: (hotelId: string, ticketId: string) =>
      ["tickets", hotelId, ticketId, "acceptances"] as const,
    escalations: (hotelId: string, ticketId: string) =>
      ["tickets", hotelId, ticketId, "escalations"] as const,
  },
};
