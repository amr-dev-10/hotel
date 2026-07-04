import {apiRequest} from '../../../services/api';
import type {ArcadiaRecord} from '../../../types/domain';

export function updateTicketAction(
  hotelId: string,
  ticketId: unknown,
  action: string,
  token: string,
  body?: Record<string, unknown>,
) {
  return apiRequest<ArcadiaRecord>(
    `/api/v1/hotels/${hotelId}/tickets/${ticketId}/${action}`,
    {
      method: 'POST',
      token,
      body: body ? JSON.stringify(body) : undefined,
    },
  );
}
