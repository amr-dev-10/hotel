export const queryKeys = {
  analytics: (hotelId: string, range: { from: string; to: string }) =>
    ["analytics", hotelId, range] as const,
  housekeeping: (hotelId: string) => ["housekeeping", hotelId] as const,
  departments: (hotelId: string) => ["departments", hotelId] as const,
  guests: (hotelId: string) => ["guests", hotelId] as const,
  guestsList: (hotelId: string, filters?: Record<string, string | number | undefined>) =>
    ["guests", hotelId, "list", filters ?? {}] as const,
  guestConsent: (hotelId: string, guestId: string) =>
    ["guests", hotelId, guestId, "consent"] as const,
  guestDetail: (hotelId: string, guestId: string) =>
    ["guests", hotelId, guestId] as const,
  guestTimeline: (hotelId: string, guestId: string) =>
    ["guests", hotelId, guestId, "timeline"] as const,
  reservations: (hotelId: string) => ["reservations", hotelId] as const,
  reservationsList: (hotelId: string, filters?: Record<string, string | number | undefined>) =>
    ["reservations", hotelId, "list", filters ?? {}] as const,
  notifications: (hotelId: string) => ["notifications", hotelId] as const,
  auditLogs: (hotelId: string, filters?: Record<string, string | number | undefined>) =>
    ["audit-logs", hotelId, filters ?? {}] as const,
  fnb: {
    categories: (hotelId: string) => ["fnb", hotelId, "categories"] as const,
    items: (hotelId: string, categoryId?: string) => ["fnb", hotelId, "items", categoryId ?? "all"] as const,
    taxes: (hotelId: string) => ["fnb", hotelId, "taxes"] as const,
    orders: (hotelId: string, filters?: Record<string, string | undefined>) =>
      ["fnb", hotelId, "orders", filters ?? {}] as const,
    order: (hotelId: string, orderId: string) => ["fnb", hotelId, "orders", orderId] as const,
  },
  guestPortal: {
    profile: () => ["guest-portal", "profile"] as const,
    categories: () => ["guest-portal", "categories"] as const,
    items: (categoryId?: string) => ["guest-portal", "items", categoryId ?? "all"] as const,
    orders: () => ["guest-portal", "orders"] as const,
    requests: () => ["guest-portal", "requests"] as const,
    requestCategories: () => ["guest-portal", "request-categories"] as const,
  },
  reservationDetail: (hotelId: string, reservationId: string) =>
    ["reservations", hotelId, reservationId] as const,
  reservationGuests: (hotelId: string, reservationId: string) =>
    ["reservations", hotelId, reservationId, "guests"] as const,
  reservationMessages: (hotelId: string, reservationId: string) =>
    ["reservations", hotelId, reservationId, "messages"] as const,
  reservationStays: (hotelId: string, reservationId: string) =>
    ["reservations", hotelId, reservationId, "stays"] as const,
  reservationFolios: (hotelId: string, reservationId: string) =>
    ["reservations", hotelId, reservationId, "folios"] as const,
  rooms: (hotelId: string, filters?: Record<string, string | number | undefined>) =>
    filters ? (["rooms", hotelId, filters] as const) : (["rooms", hotelId] as const),
  roomDetail: (hotelId: string, roomId: string) => ["rooms", hotelId, roomId] as const,
  staff: (hotelId: string, filters?: Record<string, string | number | undefined>) =>
    filters ? (["staff", hotelId, filters] as const) : (["staff", hotelId] as const),
  shifts: (hotelId: string) => ["shifts", hotelId] as const,
  roles: {
    all: (hotelId: string) => ["roles", hotelId] as const,
    permissions: (hotelId: string) => ["roles", hotelId, "permissions"] as const,
    permissionGroups: (hotelId: string) => ["roles", hotelId, "permission-groups"] as const,
  },
  hierarchy: (hotelId: string, departmentId: string) =>
    ["hierarchy", hotelId, departmentId] as const,
  ai: (hotelId: string) => ["ai-settings", hotelId] as const,
  aiAnalytics: (hotelId: string) => ["ai-analytics", hotelId] as const,
  aiDebugLogs: (hotelId: string) => ["ai-debug-logs", hotelId] as const,
  whatsapp: {
    account: (hotelId: string) => ["whatsapp", hotelId, "account"] as const,
    conversations: (hotelId: string) => ["whatsapp", hotelId, "conversations"] as const,
    messages: (hotelId: string, conversationId: string) =>
      ["whatsapp", hotelId, "conversations", conversationId, "messages"] as const,
    templates: (hotelId: string) => ["whatsapp", hotelId, "templates"] as const,
    health: (hotelId: string) => ["whatsapp", hotelId, "health"] as const,
  },
  workflow: {
    definitions: (hotelId: string) => ["workflow", hotelId, "definitions"] as const,
    states: (hotelId: string, workflowId: string) =>
      ["workflow", hotelId, workflowId, "states"] as const,
    transitions: (hotelId: string, workflowId: string) =>
      ["workflow", hotelId, workflowId, "transitions"] as const,
    escalationRules: (hotelId: string) => ["workflow", hotelId, "escalation-rules"] as const,
    ticketCategories: (hotelId: string) => ["workflow", hotelId, "ticket-categories"] as const,
    taskSlas: (hotelId: string, departmentId: string) =>
      ["workflow", hotelId, departmentId, "task-slas"] as const,
    routingRules: (hotelId: string) => ["workflow", hotelId, "routing-rules"] as const,
  },
  tickets: {
    all: (hotelId: string) => ["tickets", hotelId] as const,
    list: (hotelId: string, filters: Record<string, string | undefined>) =>
      ["tickets", hotelId, "list", filters] as const,
    acceptances: (hotelId: string, ticketId: string) =>
      ["tickets", hotelId, ticketId, "acceptances"] as const,
    escalations: (hotelId: string, ticketId: string) =>
      ["tickets", hotelId, ticketId, "escalations"] as const,
    escalatedTickets: (hotelId: string, scope: string) =>
      ["tickets", hotelId, "escalated-tickets", scope] as const,
    messages: (hotelId: string, ticketId: string) =>
      ["tickets", hotelId, ticketId, "messages"] as const,
    timeline: (hotelId: string, ticketId: string) =>
      ["tickets", hotelId, ticketId, "timeline"] as const,
    guestMessages: (hotelId: string, ticketId: string) =>
      ["tickets", hotelId, ticketId, "guest-messages"] as const,
  },
};
