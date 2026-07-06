import type {ScreenKey} from '../../navigation/types';
import {Permissions} from '../permissionCodes';
import {
  canOpenScreen,
  canUseAction,
  filterNavItemsForUser,
} from '../navigationGuard';

describe('navigationGuard', () => {
  it('allows unrestricted and admin users to open screens', () => {
    expect(canOpenScreen(undefined, 'dashboard')).toBe(true);
    expect(canOpenScreen(['admin.all'], 'staff')).toBe(true);
    expect(canOpenScreen(['*'], 'reservations')).toBe(true);
  });

  it('checks screen permissions for standard staff users', () => {
    const staffPermissions = [
      Permissions.TICKET_VIEW_OWN,
      Permissions.HOUSEKEEPING_MANAGE,
    ];

    expect(canOpenScreen(staffPermissions, 'tickets')).toBe(true);
    expect(canOpenScreen(staffPermissions, 'housekeeping')).toBe(true);
    expect(canOpenScreen(staffPermissions, 'reservations')).toBe(false);
    expect(canOpenScreen(staffPermissions, 'staff')).toBe(false);
  });

  it('checks action permissions', () => {
    expect(canUseAction([Permissions.TICKET_CREATE], 'createTicket')).toBe(true);
    expect(canUseAction([Permissions.TICKET_VIEW], 'createTicket')).toBe(false);
    expect(canUseAction([Permissions.ROOM_UPDATE], 'updateRoom')).toBe(true);
  });

  it('filters navigation items to screens the user can open', () => {
    const items: Array<{key: ScreenKey; label: string}> = [
      {key: 'dashboard', label: 'Overview'},
      {key: 'tickets', label: 'Tickets'},
      {key: 'reservations', label: 'Reservations'},
      {key: 'staff', label: 'Staff'},
    ];

    expect(
      filterNavItemsForUser(items, [Permissions.TICKET_VIEW_OWN]).map(
        item => item.key,
      ),
    ).toEqual(['dashboard', 'tickets']);
  });
});
