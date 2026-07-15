export const WebSocketEvents = {
  CONNECTION_ACK: 'connection_ack',
  NOTIFICATION: 'notification',
  TICKET_ASSIGNED: 'ticket_assigned',
  TICKET_DISPATCH: 'ticket_dispatch',
  TICKET_ESCALATED: 'ticket_escalated',
} as const;

export type WebSocketEventName =
  (typeof WebSocketEvents)[keyof typeof WebSocketEvents] | '*';
