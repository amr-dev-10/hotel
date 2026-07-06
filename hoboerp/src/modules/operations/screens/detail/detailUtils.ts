import {firstRecordValue} from '../../../../utils/dataUtils';
import type {AppData} from '../../../dashboard';
import type {ArcadiaRecord} from '../../../../types/domain';
import {text} from '../../utils';
import type {RelationLabels, TicketActivityItem, TicketWorkflowAction} from './detailTypes';

export function buildTicketActivityItems(
  timeline: ArcadiaRecord[],
  messages: ArcadiaRecord[],
): TicketActivityItem[] {
  const items: TicketActivityItem[] = [];
  const seen = new Set<string>();

  timeline.forEach((item, index) => {
    const itemType = firstRecordValue(item, ['item_type']);
    const id = firstRecordValue(item, ['id']) || `timeline-${index}`;
    const content = firstRecordValue(item, [
      'content',
      'description',
      'message_text',
      'message',
      'status',
    ]) || compactRecord(item);
    const isNote = itemType === 'message' || Boolean(firstRecordValue(item, ['sender_type']));
    const key = isNote ? `note:${id}` : `event:${id}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    items.push({
      content,
      createdAt: firstRecordValue(item, ['created_at', 'timestamp', 'updated_at']),
      id,
      raw: item,
      title: isNote
        ? `${titleCase(firstRecordValue(item, ['sender_type']) || 'Staff')} note`
        : titleCase(firstRecordValue(item, ['event_type', 'title']) || 'System event'),
      type: isNote ? 'note' : 'event',
    });
  });

  messages.forEach((message, index) => {
    const id = firstRecordValue(message, ['id']) || `message-${index}`;
    const key = `note:${id}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    items.push({
      content: firstRecordValue(message, ['content', 'message_text', 'message']) || compactRecord(message),
      createdAt: firstRecordValue(message, ['created_at', 'timestamp', 'updated_at']),
      id,
      raw: message,
      title: `${titleCase(firstRecordValue(message, ['sender_type']) || 'Staff')} note`,
      type: 'note',
    });
  });

  return items.sort((left, right) => {
    const leftTime = Date.parse(left.createdAt);
    const rightTime = Date.parse(right.createdAt);
    if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
      return 0;
    }
    return leftTime - rightTime;
  });
}

export function ticketSmartActions(stage: string, options: {
  assignedToCurrentUser: boolean;
  canAccept: boolean;
  canApprove: boolean;
  canClose: boolean;
  canReject: boolean;
  canWorkTicket: boolean;
}): TicketWorkflowAction[] {
  const normalizedStage = normalize(stage);
  const actions: TicketWorkflowAction[] = [];

  if (
    normalizedStage === 'pending_accept' ||
    (['created', 'open'].includes(normalizedStage) && options.assignedToCurrentUser)
  ) {
    if (options.canAccept) {
      actions.push({
        action: 'accept',
        key: 'accept',
        label: 'Accept',
        loadingLabel: 'Accepting...',
        menuLabel: 'Accept Ticket',
        tone: 'primary',
      });
    }
    if (options.canReject) {
      actions.push({
        action: 'reject',
        body: {reason: 'Rejected from mobile app'},
        key: 'reject',
        label: 'Reject',
        loadingLabel: 'Rejecting...',
        menuLabel: 'Reject Ticket',
        tone: 'danger',
      });
    }
  }

  if (['accepted', 'reopened'].includes(normalizedStage) && options.canClose) {
    actions.push({
      key: 'stage:in_progress',
      label: 'Start Progress',
      loadingLabel: 'Starting...',
      menuLabel: 'Move to In Progress',
      stage: 'in_progress',
      tone: 'primary',
    });
  }

  if (['accepted', 'in_progress', 'reopened'].includes(normalizedStage) && options.canWorkTicket) {
    actions.push({
        action: 'complete',
        key: 'complete',
        label: 'Complete',
        loadingLabel: 'Completing...',
        menuLabel: 'Complete Ticket',
        tone: 'success',
    });
  }

  if (['pending_approval', 'completed'].includes(normalizedStage) && options.canApprove) {
    actions.push(
      {
        action: 'approve',
        key: 'approve',
        label: 'Approve',
        loadingLabel: 'Approving...',
        menuLabel: 'Approve Ticket',
        tone: 'success',
      },
      {
        action: 'reopen',
        key: 'reopen',
        label: 'Reopen',
        loadingLabel: 'Reopening...',
        menuLabel: 'Reopen Ticket',
        tone: 'warning',
      },
    );
  }

  if (['approved', 'closed'].includes(normalizedStage) && options.canApprove) {
    actions.push({
      action: 'reopen',
      key: 'reopen',
      label: 'Reopen',
      loadingLabel: 'Reopening...',
      menuLabel: 'Reopen Ticket',
      tone: 'warning',
    });
  }

  if (['created', 'open', 'pending_accept'].includes(normalizedStage) && options.canClose) {
    actions.push({
      key: 'stage:cancelled',
      label: 'Cancel',
      loadingLabel: 'Cancelling...',
      menuLabel: 'Cancel Ticket',
      stage: 'cancelled',
      tone: 'danger',
    });
  }

  return actions;
}

export function compactPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (value === undefined || value === null) {
        return false;
      }
      if (typeof value === 'string') {
        return value.trim() !== '';
      }
      return true;
    }),
  );
}

export function compactRecord(record: ArcadiaRecord) {
  return Object.entries(record)
    .slice(0, 4)
    .map(([key, value]) => `${formatKey(key)}: ${formatValue(value)}`)
    .join(' / ');
}

export function formatKey(key: string) {
  return key
    .replaceAll('_', ' ')
    .replace(/\b\w/g, match => match.toUpperCase());
}

export function buildRelationLabels(data: AppData, record: ArcadiaRecord = {}) {
  const labels: RelationLabels = {};

  const addRecord = (item: ArcadiaRecord, displayKeys: string[]) => {
    const label = firstRecordValue(item, displayKeys);
    if (!label) {
      return;
    }

    [
      'id',
      'user_id',
      'staff_id',
      'guest_id',
      'room_id',
      'reservation_id',
      'conversation_id',
      'assigned_to',
    ].forEach(key => {
      const id = firstRecordValue(item, [key]);
      if (id) {
        labels[id] = label;
      }
    });
  };

  data.staff.forEach(item => addRecord(item, ['name', 'full_name', 'email', 'id']));
  data.guests.forEach(item => addRecord(item, ['name', 'guest_name', 'full_name', 'phone', 'id']));
  data.rooms.forEach(item => addRecord(item, ['room_number', 'name', 'number', 'id']));
  data.reservations.forEach(item => addRecord(item.raw, ['reservation_no', 'booking_id', 'guest_name', 'id']));
  data.whatsapp.forEach(item => addRecord(item, ['guest_name', 'contact_name', 'phone', 'id']));

  const assignedTo = firstRecordValue(record, ['assigned_to', 'assigned_to_id', 'assigned_staff_id']);
  const assignedToName = firstRecordValue(record, ['assigned_to_name', 'assignee_name', 'staff_name']);
  if (assignedTo && assignedToName) {
    labels[assignedTo] = assignedToName;
  }

  const followerIds = record.followers;
  const followerNames = firstArrayValue(record, ['follower_names', 'followers_names']);
  if (Array.isArray(followerIds) && followerNames.length) {
    followerIds.forEach((id, index) => {
      const label = text(followerNames[index]);
      if (label) {
        labels[text(id)] = label;
      }
    });
  }

  return labels;
}

function firstArrayValue(record: ArcadiaRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
}

export function formatValue(value: unknown, relationLabels: RelationLabels = {}): string {
  if (Array.isArray(value)) {
    const formatted: string[] = value
      .map(item => formatValue(item, relationLabels))
      .filter(Boolean);
    return formatted.length ? formatted.join(', ') : 'None';
  }
  if (value && typeof value === 'object') {
    const record = value as ArcadiaRecord;
    const displayName =
      firstRecordValue(record, ['name', 'full_name', 'guest_name', 'contact_name', 'room_number', 'reservation_no']) ||
      relationLabels[firstRecordValue(record, ['id', 'user_id', 'guest_id', 'room_id', 'reservation_id', 'conversation_id'])];
    if (displayName) {
      return displayName;
    }
    return Object.entries(record)
      .slice(0, 4)
      .map(([key, nestedValue]) => `${formatKey(key)}: ${formatValue(nestedValue, relationLabels)}`)
      .join(' / ');
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  const raw = text(value);
  return relationLabels[raw] ?? raw;
}

export function actionProcessLabel(subject: string, action: string | null, fallback: string) {
  if (!action) {
    return fallback;
  }

  const labels: Record<string, string> = {
    'check-in': 'Completing check in',
    'check-out': 'Completing check out',
    'guest-whatsapp': 'Sending WhatsApp message',
    note: `Saving ${subject} note`,
    send: 'Sending WhatsApp message',
    stage: `Updating ${subject} stage`,
    whatsapp: 'Opening WhatsApp conversation',
  };

  if (action.startsWith('stage:')) {
    return `Updating ${subject} stage`;
  }

  return labels[action] ?? `${titleCase(action)} ${subject}`;
}

export function titleCase(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, match => match.toUpperCase());
}

export function stageValue(value: string) {
  const normalized = normalize(value);
  if (normalized.includes('progress')) {
    return 'in_progress';
  }
  if (normalized.includes('complete')) {
    return 'completed';
  }
  if (normalized.includes('approved') || normalized.includes('closed')) {
    return 'approved';
  }
  return normalized || 'accepted';
}

export function normalize(value: string) {
  return value.toLowerCase().replaceAll(' ', '_');
}
