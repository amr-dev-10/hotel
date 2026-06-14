export const queryKeys = {
  analytics: (hotelId: string, range: { from: string; to: string }) =>
    ["analytics", hotelId, range] as const,
  housekeeping: (hotelId: string) => ["housekeeping", hotelId] as const,
  departments: (hotelId: string) => ["departments", hotelId] as const,
  reservations: (hotelId: string) => ["reservations", hotelId] as const,
  rooms: (hotelId: string) => ["rooms", hotelId] as const,
  staff: (hotelId: string) => ["staff", hotelId] as const,
  roles: {
    all: (hotelId: string) => ["roles", hotelId] as const,
    permissions: (hotelId: string) => ["roles", hotelId, "permissions"] as const,
    permissionGroups: (hotelId: string) => ["roles", hotelId, "permission-groups"] as const,
  },
  hierarchy: (hotelId: string, departmentId: string) =>
    ["hierarchy", hotelId, departmentId] as const,
  ai: (hotelId: string) => ["ai-settings", hotelId] as const,
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
    taskSlas: (hotelId: string, departmentId: string) =>
      ["workflow", hotelId, departmentId, "task-slas"] as const,
    routingRules: (hotelId: string) => ["workflow", hotelId, "routing-rules"] as const,
  },
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
