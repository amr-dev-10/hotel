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

  const normalizedFilter = filter.toLowerCase();
  return records.filter(record =>
    recordStatus(record).toLowerCase().includes(normalizedFilter),
  );
}

export function filterByStatus<T extends {status: string}>(
  items: T[],
  filter: string,
) {
  if (filter === 'All' || filter === 'Today') {
    return items;
  }

  const normalizedFilter = filter.toLowerCase();
  return items.filter(item =>
    item.status.toLowerCase().includes(normalizedFilter),
  );
}

export function countRecordsByStatus(records: ArcadiaRecord[], status: string) {
  return records.filter(record =>
    recordStatus(record).toLowerCase().includes(status),
  ).length;
}

export function formatAmount(value: string) {
  if (!value) {
    return '';
  }

  const number = Number(value);
  return Number.isNaN(number) ? value : `₹${number.toFixed(2)}`;
}
