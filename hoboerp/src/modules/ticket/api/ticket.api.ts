import {apiRequest} from '../../../services/api';
import type {ArcadiaRecord} from '../../../types/domain';

export function updateTicketAction(
  hotelId: string,
  ticketId: unknown,
  action: string,
  token: string,
  body?: Record<string, unknown>,
  method: 'POST' | 'DELETE' = 'POST',
) {
  const path =
    action === 'delete'
      ? `/api/v1/hotels/${hotelId}/tickets/${ticketId}`
      : `/api/v1/hotels/${hotelId}/tickets/${ticketId}/${action}`;

  return apiRequest<ArcadiaRecord>(
    path,
    {
      method,
      token,
      body: body ? JSON.stringify(body) : undefined,
    },
  );
}
