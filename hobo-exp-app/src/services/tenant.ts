const DEFAULT_HOTEL_ID = '';

let currentHotelId: string = DEFAULT_HOTEL_ID;
let currentHotelName: string | null = null;

const INVALID_HOTEL_ID_CHARS = ['.', '#', '$', '[', ']', '/'];

export const TenantManager = {
  setTenant(hotelId?: string | null, hotelName?: string | null) {
    if (hotelId && isValidHotelId(hotelId)) {
      currentHotelId = hotelId;
    }
    if (hotelName !== undefined) {
      currentHotelName = hotelName ?? null;
    }
  },

  syncFromSession(hotelId?: string | null, hotelName?: string | null) {
    currentHotelId = hotelId && isValidHotelId(hotelId) ? hotelId : DEFAULT_HOTEL_ID;
    currentHotelName = hotelName ?? null;
  },

  clearTenant() {
    currentHotelId = DEFAULT_HOTEL_ID;
    currentHotelName = null;
  },

  getHotelId() {
    return currentHotelId;
  },

  getHotelName() {
    return currentHotelName;
  },

  hasHotelId() {
    return Boolean(currentHotelId && isValidHotelId(currentHotelId));
  },

  isValidHotelId,

  rtdbPath(path: string) {
    if (!isValidHotelId(currentHotelId)) {
      // After logout, in-flight subscriptions may briefly request paths
      // before they unsubscribe. Return a sentinel path that resolves to no
      // data instead of throwing — keeps the logout flow clean.
      return `__no_tenant__/${path}`;
    }
    return `${currentHotelId}/${path}`;
  },

  guestDocId(phone: string) {
    if (!isValidHotelId(currentHotelId)) {
      return `__no_tenant____${normalizePhone(phone)}`;
    }
    return `${currentHotelId}__${normalizePhone(phone)}`;
  },
};

export function normalizePhone(phone: string | null | undefined) {
  return (phone ?? '').replace(/[^0-9+]/g, '');
}

export function isValidHotelId(hotelId: string | null | undefined) {
  if (!hotelId) return false;
  for (const char of INVALID_HOTEL_ID_CHARS) {
    if (hotelId.includes(char)) return false;
  }
  return true;
}