import {
  canViewAllEscalations,
  escalationMetrics,
  escalationScopeOptions,
  normalizeEscalations,
} from '../utils';

describe('escalation domain helpers', () => {
  test('normalizes nested escalated ticket payloads into explicit fields', () => {
    const [item] = normalizeEscalations([
      {
        escalation_id: 'esc-1',
        escalation_level: 3,
        escalated_at: '2026-07-06T10:00:00Z',
        escalated_to_name: 'Ops Manager',
        reason: 'sla_breached',
        ticket_id: 'ticket-1',
        ticket: {
          assigned_to_name: 'Aman',
          id: 'ticket-1',
          item_description: 'AC not cooling',
          priority: 4,
          room_number: '204',
          stage: 'pending_accept',
          ticket_code: 'T-100',
        },
      },
    ]);

    expect(item.escalation_level).toBe(3);
    expect(item.ticket.priority).toBe(4);
    expect(item.ticket.stage).toBe('pending_accept');
    expect(item.escalated_to_name).toBe('Ops Manager');
  });

  test('computes web-parity metrics from normalized rows', () => {
    const rows = normalizeEscalations([
      {ticket: {priority: 4, stage: 'pending_accept'}},
      {ticket: {priority: 2, stage: 'in_progress'}},
    ]);

    expect(escalationMetrics(rows)).toEqual({
      critical: 1,
      pending: 1,
      total: 2,
    });
  });

  test('limits all-escalations scope to admins or ticket view-all users', () => {
    expect(
      canViewAllEscalations({
        email: 'owner@example.com',
        hotel_id: 'hotel-1',
        id: 'owner-1',
        is_hotel_owner: true,
      }),
    ).toBe(true);
    expect(
      escalationScopeOptions({
        email: 'staff@example.com',
        hotel_id: 'hotel-1',
        id: 'staff-1',
      }),
    ).toEqual(['department', 'mine']);
  });
});
