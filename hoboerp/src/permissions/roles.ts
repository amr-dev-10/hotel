export const hotelRoles = {
  hotelAdmin: 'HOTEL_ADMIN',
  employee: 'EMPLOYEE',
};

export function isHotelAdmin(userType?: string | null) {
  return userType === hotelRoles.hotelAdmin || userType === 'hotel_admin';
}
