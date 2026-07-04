import {apiRequest} from '../../../services/api';
import type {ArcadiaRecord} from '../../../types/domain';

export function updateOrderStatus(
  hotelId: string,
  orderId: unknown,
  status: string,
  token: string,
) {
  return apiRequest<ArcadiaRecord>(
    `/api/v1/hotels/${hotelId}/restaurant/orders/${orderId}/status`,
    {
      method: 'PATCH',
      token,
      body: JSON.stringify({status}),
    },
  );
}
