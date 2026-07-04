import type {ArcadiaRecord} from '../../types/domain';
import type {ResourceKey} from './types';

export function getActions(resource: ResourceKey, item: ArcadiaRecord) {
  const state = text(resource === 'tickets' ? item.stage : item.status);

  if (resource === 'tickets') {
    if (state === 'pending_accept') {
      return [
        {label: 'Accept', value: 'accept', tone: 'primary' as const},
        {label: 'Reject', value: 'reject', tone: 'danger' as const},
      ];
    }
    if (['accepted', 'in_progress', 'assigned'].includes(state)) {
      return [{label: 'Complete', value: 'complete', tone: 'primary' as const}];
    }
    if (state === 'completed') {
      return [
        {label: 'Approve', value: 'approve', tone: 'primary' as const},
        {label: 'Reopen', value: 'reopen'},
      ];
    }
    if (['approved', 'closed', 'resolved'].includes(state)) {
      return [{label: 'Reopen', value: 'reopen'}];
    }
  }

  if (resource === 'orders') {
    if (['received', 'pending'].includes(state)) {
      return [{label: 'Preparing', value: 'preparing', tone: 'primary' as const}];
    }
    if (state === 'preparing') {
      return [{label: 'Ready', value: 'ready', tone: 'primary' as const}];
    }
    if (state === 'ready') {
      return [{label: 'Delivered', value: 'delivered', tone: 'primary' as const}];
    }
  }

  return [];
}

export function filterRecords(items: ArcadiaRecord[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return items;
  }

  return items.filter(item =>
    Object.values(item).some(value =>
      text(value).toLowerCase().includes(needle),
    ),
  );
}

export function recordDetails(resource: ResourceKey, item: ArcadiaRecord) {
  if (resource === 'tickets') {
    return cleanDetails([
      ['Code', text(item.ticket_code)],
      ['Guest', text(item.guest_name) || 'Unassigned'],
      ['Room', text(item.room_number) || 'No room'],
      ['Assignee', text(item.assigned_to_name) || 'Unassigned'],
      ['Priority', text(item.priority)],
      ['Source', text(item.source)],
      ['Created', compactDate(item.created_at)],
    ]);
  }

  if (resource === 'reservations') {
    return cleanDetails([
      ['Reservation', text(item.reservation_no) || text(item.id)],
      ['Guest', text(item.guest_name) || text(item.primary_guest_name)],
      ['Room', text(item.room_number) || 'Unassigned'],
      ['Check-in', compactDate(item.check_in_date ?? item.checkin_date)],
      ['Check-out', compactDate(item.check_out_date ?? item.checkout_date)],
      ['Status', text(item.status)],
    ]);
  }

  if (resource === 'rooms') {
    return cleanDetails([
      ['Room', text(item.room_number) || text(item.name)],
      ['Type', text(item.room_type) || text(item.room_type_name)],
      ['Floor', text(item.floor)],
      ['Status', text(item.status)],
      ['Notes', text(item.notes)],
    ]);
  }

  return cleanDetails([
    ['Order', text(item.order_number) || text(item.id)],
    ['Status', text(item.status)],
    ['Source', text(item.source)],
    ['Total', currency(item.total_amount ?? item.total)],
    ['Instructions', text(item.special_instructions) || text(item.instructions)],
    ['Created', compactDate(item.created_at)],
  ]);
}

export function text(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

export function compactDate(value: unknown): string {
  const raw = text(value);
  if (!raw) {
    return '';
  }
  return raw.includes('T') ? raw.split('T')[0] : raw;
}

export function currency(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const number = Number(value);
  return Number.isNaN(number) ? text(value) : `₹${number.toFixed(2)}`;
}

export function statusTone(
  value: string,
): 'green' | 'blue' | 'orange' | 'red' | 'gray' {
  const normalized = normalize(value);
  if (
    normalized.includes('complete') ||
    normalized.includes('checked in') ||
    normalized.includes('on duty') ||
    normalized === 'active'
  ) {
    return 'green';
  }
  if (normalized.includes('late')) {
    return 'red';
  }
  if (normalized.includes('progress') || normalized.includes('upcoming')) {
    return 'blue';
  }
  if (
    normalized.includes('pending') ||
    normalized.includes('open') ||
    normalized.includes('break')
  ) {
    return 'orange';
  }
  if (
    normalized.includes('cancel') ||
    normalized.includes('off duty') ||
    normalized.includes('inactive') ||
    normalized.includes('out') ||
    normalized.includes('closed')
  ) {
    return 'gray';
  }
  return 'blue';
}

export function priorityTone(
  value: string,
): 'green' | 'blue' | 'orange' | 'red' | 'gray' {
  const normalized = normalize(value);
  if (
    normalized.includes('critical') ||
    normalized.includes('urgent') ||
    normalized.includes('high') ||
    ['4', '5', 'p1'].includes(normalized)
  ) {
    return 'red';
  }
  if (normalized.includes('medium') || normalized.includes('elevated') || ['2', '3', 'p2'].includes(normalized)) {
    return 'orange';
  }
  if (normalized.includes('low') || ['1', 'p3'].includes(normalized)) {
    return 'green';
  }
  return 'blue';
}

function normalize(value: string) {
  return value.toLowerCase().replaceAll('_', ' ');
}

function cleanDetails(rows: [string, string][]) {
  return rows
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => ({label, value}));
}
