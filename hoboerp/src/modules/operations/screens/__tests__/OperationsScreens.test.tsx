import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';

import {Permissions} from '../../../../permissions/permissionCodes';
import type {AppData} from '../../../dashboard';
import type {UserProfile} from '../../../../types/domain';
import {ScreenContent} from '../ScreenContent';

const dashboardData: AppData = {
  escalations: [],
  guests: [],
  housekeeping: [{id: 'task-1'}],
  notifications: [],
  occupancy: 64,
  occupiedRooms: 32,
  openTickets: 3,
  orders: [{id: 'order-1'}],
  outOfOrderRooms: 1,
  reservations: [],
  rooms: [],
  roomsTotal: 50,
  staff: [{id: 'staff-1'}],
  tickets: [],
  todayCheckIns: 5,
  todayCheckOuts: 2,
  vacantRooms: 17,
  whatsapp: [],
};

const user: UserProfile = {
  email: 'owner@admin.com',
  hotel_id: 'hotel-1',
  id: 'user-1',
  name: 'Owner',
};

async function renderDashboard(permissions: string[] = ['*']) {
  const props = {
    data: dashboardData,
    error: null,
    hotelName: 'Arcadia Suites',
    loading: false,
    loadingProcesses: [],
    onBack: jest.fn(),
    onLogout: jest.fn(),
    onMenu: jest.fn(),
    onNavigate: jest.fn(),
    onOpenContextTicketForm: jest.fn(),
    onOpenGuest: jest.fn(),
    onOpenNotifications: jest.fn(),
    onOpenProfileOption: jest.fn(),
    onOpenReservation: jest.fn(),
    onOpenReservationForm: jest.fn(),
    onOpenRoomForm: jest.fn(),
    onOpenStaffProfile: jest.fn(),
    onOpenTicket: jest.fn(),
    onOpenTicketForm: jest.fn(),
    onOpenWhatsAppChat: jest.fn(),
    onQuickRecordAction: jest.fn(),
    onRefresh: jest.fn(),
    onRefreshResource: jest.fn(),
    onShowDialog: jest.fn(),
    permissions,
    request: async <T,>() => ({data: undefined as T | undefined}),
    screen: 'dashboard' as const,
    selectedConversation: null,
    selectedGuest: null,
    selectedReservation: null,
    selectedTicket: null,
    user: {...user, permissions},
  };

  return {props, ...(await render(<ScreenContent {...props} />))};
}

describe('Operations dashboard screen', () => {
  it('renders department rows and quick actions for a permitted user', async () => {
    const {getByText, props} = await renderDashboard([
      Permissions.GUEST_VIEW,
      Permissions.HOUSEKEEPING_MANAGE,
      Permissions.MENU_VIEW,
      Permissions.RESERVATION_VIEW,
      Permissions.RESTAURANT_MANAGE,
      Permissions.STAFF_VIEW,
      Permissions.TICKET_CREATE,
      Permissions.TICKET_VIEW,
    ]);

    expect(getByText('Department Status')).toBeOnTheScreen();
    expect(getByText('Housekeeping')).toBeOnTheScreen();
    expect(getByText('Tickets')).toBeOnTheScreen();
    expect(getByText('F&B Service')).toBeOnTheScreen();
    expect(getByText('Staff')).toBeOnTheScreen();
    expect(getByText('Quick Actions')).toBeOnTheScreen();
    expect(getByText('Create Ticket')).toBeOnTheScreen();
    expect(getByText('Reservation')).toBeOnTheScreen();
    expect(getByText('Guest')).toBeOnTheScreen();
    expect(getByText('Kitchen')).toBeOnTheScreen();

    await fireEvent.press(getByText('Create Ticket'));
    await fireEvent.press(getByText('Reservation'));

    expect(props.onOpenTicketForm).toHaveBeenCalledTimes(1);
    expect(props.onNavigate).toHaveBeenCalledWith('reservations');
  });

  it('hides dashboard affordances the user cannot access', async () => {
    const {getByText, queryByText} = await renderDashboard([
      Permissions.TICKET_VIEW_OWN,
    ]);

    expect(getByText('Tickets')).toBeOnTheScreen();
    expect(queryByText('Housekeeping')).toBeNull();
    expect(queryByText('F&B Service')).toBeNull();
    expect(queryByText('Staff')).toBeNull();
    expect(queryByText('Quick Actions')).toBeNull();
    expect(queryByText('Create Ticket')).toBeNull();
    expect(queryByText('Reservation')).toBeNull();
    expect(queryByText('Guest')).toBeNull();
    expect(queryByText('Kitchen')).toBeNull();
  });
});
