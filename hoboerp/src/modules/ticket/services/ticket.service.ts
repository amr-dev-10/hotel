import {updateTicketAction} from '../api/ticket.api';

export function runTicketWorkflowAction(
  hotelId: string,
  ticketId: unknown,
  action: string,
  token: string,
) {
  const body =
    action === 'reject' ? {reason: 'Rejected from mobile app'} : undefined;

  return updateTicketAction(hotelId, ticketId, action, token, body);
}
