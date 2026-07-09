import type {ScreenKey} from '../navigation/types';
import {
  Permissions,
  shiftViewPermissions,
  ticketViewPermissions,
} from './permissionCodes';
import {hasAnyPermission} from './rbac';

export const screenPermissionMap: Partial<Record<ScreenKey, string[]>> = {
  assistant: [Permissions.BOT_VIEW, Permissions.BOT_MANAGE],
  escalations: ticketViewPermissions,
  food: [Permissions.RESTAURANT_MANAGE, Permissions.MENU_VIEW, Permissions.MENU_MANAGE],
  guestDetail: [Permissions.GUEST_VIEW, Permissions.GUEST_VIEW_BASIC],
  guests: [Permissions.GUEST_VIEW, Permissions.GUEST_VIEW_BASIC],
  housekeeping: [Permissions.HOUSEKEEPING_MANAGE],
  hierarchy: [Permissions.USER_VIEW, Permissions.STAFF_VIEW],
  kitchen: [Permissions.RESTAURANT_MANAGE],
  reservationDetail: [Permissions.RESERVATION_VIEW],
  reservations: [Permissions.RESERVATION_VIEW],
  room: [Permissions.ROOM_VIEW],
  staff: [Permissions.STAFF_VIEW, Permissions.USER_VIEW, ...shiftViewPermissions],
  ticketDetail: ticketViewPermissions,
  ticketForm: [Permissions.TICKET_CREATE],
  tickets: ticketViewPermissions,
  whatsapp: [Permissions.LIVE_CHAT_MANAGE],
  whatsappChat: [Permissions.LIVE_CHAT_MANAGE],
};

export const actionPermissionMap = {
  createReservation: [Permissions.RESERVATION_CREATE],
  createRoom: [Permissions.ROOM_CREATE],
  createTicket: [Permissions.TICKET_CREATE],
  updateRoom: [Permissions.ROOM_UPDATE],
  viewStaffProfile: [Permissions.STAFF_VIEW, Permissions.USER_VIEW],
} as const;

export function canOpenScreen(
  permissions: string[] | undefined,
  screen: ScreenKey,
) {
  const required = screenPermissionMap[screen];

  if (!required?.length) {
    return true;
  }

  return hasAnyPermission(permissions, required);
}

export function canUseAction(
  permissions: string[] | undefined,
  action: keyof typeof actionPermissionMap,
) {
  return hasAnyPermission(permissions, actionPermissionMap[action]);
}

export function filterNavItemsForUser<T extends {key: ScreenKey}>(
  items: T[],
  permissions: string[] | undefined,
) {
  return items.filter(item => canOpenScreen(permissions, item.key));
}

export function requiredPermissionLabel(screen: ScreenKey) {
  return screenPermissionMap[screen]?.join(', ') ?? 'a permitted role';
}
