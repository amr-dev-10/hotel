import type {AppData} from '../../modules/dashboard';
import {
  buildRelationLabels,
  buildTicketActivityItems,
  formatValue,
  ticketSmartActions,
} from './DetailScreens';

function appData(overrides: Partial<AppData> = {}): AppData {
  return {
    escalations: [],
    guests: [],
    housekeeping: [],
    notifications: [],
    occupiedRooms: 0,
    openTickets: 0,
    orders: [],
    outOfOrderRooms: 0,
    rooms: [],
    roomsTotal: 0,
    staff: [],
    tickets: [],
    todayCheckIns: 0,
    todayCheckOuts: 0,
    vacantRooms: 0,
    whatsapp: [],
    reservations: [],
    occupancy: 0,
    ...overrides,
  };
}

describe('ticketSmartActions', () => {
  test('shows pending acceptance actions and owner cancellation when available', () => {
    const actions = ticketSmartActions('pending_accept', {
      assignedToCurrentUser: true,
      canAccept: true,
      canApprove: false,
      canClose: true,
      canReject: true,
      canWorkTicket: false,
    });

    expect(actions.map(action => action.key)).toEqual([
      'accept',
      'reject',
      'stage:cancelled',
    ]);
  });

  test('keeps in-progress stage and completion as separate backend actions', () => {
    const actions = ticketSmartActions('accepted', {
      assignedToCurrentUser: true,
      canAccept: false,
      canApprove: false,
      canClose: true,
      canReject: false,
      canWorkTicket: true,
    });

    expect(actions.map(action => action.key)).toEqual([
      'stage:in_progress',
      'complete',
    ]);
  });

  test('shows approval actions only for users allowed to approve', () => {
    expect(
      ticketSmartActions('pending_approval', {
        assignedToCurrentUser: false,
        canAccept: false,
        canApprove: true,
        canClose: false,
        canReject: false,
        canWorkTicket: false,
      }).map(action => action.key),
    ).toEqual(['approve', 'reopen']);

    expect(
      ticketSmartActions('pending_approval', {
        assignedToCurrentUser: false,
        canAccept: false,
        canApprove: false,
        canClose: false,
        canReject: false,
        canWorkTicket: false,
      }),
    ).toEqual([]);
  });
});

describe('ticket detail helpers', () => {
  test('formats assigned staff and followers with display names', () => {
    const relationLabels = buildRelationLabels(
      appData({
        staff: [
          {id: 'staff-1', name: 'Priya Shah'},
          {id: 'staff-2', full_name: 'Aman Verma'},
        ],
      }),
      {
        assigned_to: 'staff-1',
        assigned_to_name: 'Priya Shah',
        followers: ['staff-1', 'staff-2'],
      },
    );

    expect(formatValue('staff-1', relationLabels)).toBe('Priya Shah');
    expect(formatValue(['staff-1', 'staff-2'], relationLabels)).toBe(
      'Priya Shah, Aman Verma',
    );
    expect(formatValue({id: 'staff-2'}, relationLabels)).toBe('Aman Verma');
  });

  test('merges timeline events and staff notes without duplicating message ids', () => {
    const items = buildTicketActivityItems(
      [
        {
          id: 'event-1',
          event_type: 'created',
          created_at: '2026-07-05T10:00:00Z',
          description: 'Ticket created',
        },
        {
          id: 'note-1',
          item_type: 'message',
          sender_type: 'staff',
          created_at: '2026-07-05T10:05:00Z',
          content: 'Checked with guest',
        },
      ],
      [
        {
          id: 'note-1',
          sender_type: 'staff',
          created_at: '2026-07-05T10:05:00Z',
          content: 'Duplicate note',
        },
      ],
    );

    expect(items).toHaveLength(2);
    expect(items.map(item => item.id)).toEqual(['event-1', 'note-1']);
    expect(items[1].content).toBe('Checked with guest');
  });
});
