import {updateOrderStatus} from '../api/order.api';

export function moveOrderToStatus(
  hotelId: string,
  orderId: unknown,
  status: string,
  token: string,
) {
  return updateOrderStatus(hotelId, orderId, status, token);
}
