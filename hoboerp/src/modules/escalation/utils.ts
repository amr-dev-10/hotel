import type {TicketView} from '../dashboard';
import type {ArcadiaRecord, UserProfile} from '../../types/domain';
import {firstRecordValue} from '../../utils/dataUtils';
import {hasPermission} from '../../permissions/rbac';
import {Permissions} from '../../permissions/permissionCodes';
import type {
  EscalatedTicket,
  EscalationMetrics,
  EscalationScope,
} from './types';

export const escalationScopeLabels: Record<EscalationScope, string> = {
  all: 'All Escalations',
  department: 'Department',
  mine: 'Mine',
};

export function normalizeEscalations(records: ArcadiaRecord[]): EscalatedTicket[] {
  return records.map(toEscalatedTicket);
}

export function toEscalatedTicket(record: ArcadiaRecord): EscalatedTicket {
  const nestedTicket = asRecord(record.ticket) ?? record;
  const ticketId =
    firstRecordValue(record, ['ticket_id']) ||
    firstRecordValue(nestedTicket, ['id', 'ticket_id']);
  const escalationId =
    firstRecordValue(record, ['escalation_id', 'id']) ||
    `${ticketId || 'ticket'}:${firstRecordValue(record, ['created_at', 'escalated_at'])}`;
  const priority = toNumber(
    firstRecordValue(nestedTicket, ['priority', 'ticket_priority']),
    0,
  );

  return {
    escalation_id: escalationId,
    escalation_level: toNumber(
      firstRecordValue(record, ['escalation_level', 'level', 'severity']),
      0,
    ),
    escalated_at: firstRecordValue(record, ['escalated_at', 'created_at', 'updated_at']),
    escalated_from: nullable(firstRecordValue(record, ['escalated_from', 'from_user_id'])),
    escalated_from_name: nullable(
      firstRecordValue(record, ['escalated_from_name', 'from_user_name']),
    ),
    escalated_to: nullable(firstRecordValue(record, ['escalated_to', 'to_user_id'])),
    escalated_to_name: nullable(
      firstRecordValue(record, [
        'escalated_to_name',
        'to_user_name',
        'owner_name',
        'assigned_to_name',
        'team_name',
      ]),
    ),
    notes: nullable(firstRecordValue(record, ['notes', 'note'])),
    raw: record,
    reason: firstRecordValue(record, ['reason', 'summary', 'title']) || 'escalated',
    rule_id: nullable(firstRecordValue(record, ['rule_id'])),
    ticket: {
      assigned_to: nullable(firstRecordValue(nestedTicket, ['assigned_to', 'assignee_id'])),
      assigned_to_name: nullable(
        firstRecordValue(nestedTicket, ['assigned_to_name', 'assignee_name']),
      ),
      guest_name: nullable(firstRecordValue(nestedTicket, ['guest_name', 'guest_full_name'])),
      id: ticketId,
      item_description:
        firstRecordValue(nestedTicket, [
          'item_description',
          'description',
          'title',
          'ticket_title',
        ]) || firstRecordValue(record, ['title', 'summary', 'reason']),
      priority,
      raw: nestedTicket,
      room_number: nullable(firstRecordValue(nestedTicket, ['room_number', 'room'])),
      stage: firstRecordValue(nestedTicket, ['stage', 'status']) || 'open',
      ticket_code:
        firstRecordValue(nestedTicket, ['ticket_code', 'code']) ||
        firstRecordValue(record, ['ticket_code', 'code']) ||
        ticketId,
    },
    ticket_id: ticketId,
  };
}

export function escalationMetrics(rows: EscalatedTicket[]): EscalationMetrics {
  return {
    critical: rows.filter(item => item.ticket.priority >= 4).length,
    pending: rows.filter(item => normalize(item.ticket.stage) === 'pending accept').length,
    total: rows.length,
  };
}

export function canViewAllEscalations(user: UserProfile) {
  return Boolean(
    user.is_hotel_owner ||
      user.user_type === 'HOTEL_ADMIN' ||
      user.staff_level === 'admin' ||
      hasPermission(user.permissions, Permissions.TICKET_VIEW_ALL),
  );
}

export function defaultEscalationScope(user: UserProfile): EscalationScope {
  return canViewAllEscalations(user) ? 'all' : 'department';
}

export function escalationScopeOptions(user: UserProfile): EscalationScope[] {
  return canViewAllEscalations(user) ? ['all', 'department', 'mine'] : ['department', 'mine'];
}

export function escalationMatchesStatus(item: EscalatedTicket, filter: string) {
  if (filter === 'All') {
    return true;
  }

  const normalizedFilter = normalize(filter);
  const stage = normalize(item.ticket.stage);
  const reason = normalize(item.reason);

  if (normalizedFilter === 'unassigned') {
    return !item.ticket.assigned_to && !item.ticket.assigned_to_name;
  }
  if (normalizedFilter === 'pending accept') {
    return stage === 'pending accept';
  }
  if (normalizedFilter === 'backlog') {
    return stage.includes('backlog') || reason.includes('backlog');
  }
  if (normalizedFilter === 'breached') {
    return reason.includes('breach') || reason.includes('sla');
  }
  return stage.includes(normalizedFilter) || reason.includes(normalizedFilter);
}

export function escalationSearchBlob(item: EscalatedTicket) {
  return [
    item.ticket.ticket_code,
    item.ticket.item_description,
    item.ticket.assigned_to_name,
    item.escalated_to_name,
    item.reason,
    item.ticket.room_number,
    item.ticket.guest_name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function escalationToTicketView(item: EscalatedTicket): TicketView {
  return {
    code: item.ticket.ticket_code,
    createdAt: item.escalated_at,
    department: '',
    guestName: item.ticket.guest_name ?? '',
    id: item.ticket_id || item.ticket.id,
    priority: String(item.ticket.priority),
    raw: item.ticket.raw,
    roomNumber: item.ticket.room_number ?? '',
    status: item.ticket.stage,
    title: item.ticket.item_description,
  };
}

export function formatEscalationAge(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value || 'Time unknown';
  }

  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  const units: [number, string][] = [
    [60 * 60 * 24, 'day'],
    [60 * 60, 'hour'],
    [60, 'minute'],
  ];
  for (const [unitSeconds, label] of units) {
    const amount = Math.floor(seconds / unitSeconds);
    if (amount >= 1) {
      return `${amount} ${label}${amount === 1 ? '' : 's'} ago`;
    }
  }
  return 'Just now';
}

export function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, match => match.toUpperCase());
}

function asRecord(value: unknown): ArcadiaRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as ArcadiaRecord;
}

function nullable(value: string) {
  return value || null;
}

function normalize(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').trim();
}

function toNumber(value: string, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
