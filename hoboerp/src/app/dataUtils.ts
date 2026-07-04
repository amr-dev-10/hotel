import type {ArcadiaRecord} from '../types/domain';

export function firstRecordValue(
  record: ArcadiaRecord | null | undefined,
  keys: string[],
) {
  if (!record) {
    return '';
  }

  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }

  return '';
}

export function recordStatus(record: ArcadiaRecord) {
  return firstRecordValue(record, [
    'status',
    'stage',
    'attendance_status',
    'ticket_status',
    'order_status',
  ]);
}

export function filterRecordsByStatus(records: ArcadiaRecord[], filter: string) {
  if (filter === 'All' || filter === 'Today') {
    return records;
  }

  const normalizedFilter = normalizeStatus(filter);
  return records.filter(record =>
    normalizeStatus(recordStatus(record)).includes(normalizedFilter),
  );
}

export function filterByStatus<T extends {status: string}>(
  items: T[],
  filter: string,
) {
  if (filter === 'All' || filter === 'Today') {
    return items;
  }

  const normalizedFilter = normalizeStatus(filter);
  return items.filter(item =>
    normalizeStatus(item.status).includes(normalizedFilter),
  );
}

export function countRecordsByStatus(records: ArcadiaRecord[], status: string) {
  return records.filter(record =>
    normalizeStatus(recordStatus(record)).includes(normalizeStatus(status)),
  ).length;
}

export function isRecordTruthy(record: ArcadiaRecord, keys: string[]) {
  return keys.some(key => {
    const value = record[key];
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value > 0;
    }
    return ['true', '1', 'yes', 'linked'].includes(
      String(value ?? '').toLowerCase(),
    );
  });
}

export function formatAmount(value: string) {
  if (!value) {
    return '';
  }

  const number = Number(value);
  return Number.isNaN(number) ? value : `₹${number.toFixed(2)}`;
}

function normalizeStatus(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').trim();
}
