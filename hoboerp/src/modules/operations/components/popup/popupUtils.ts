import type {PopupKey} from '../../../../navigation/types';
import type {ArcadiaRecord} from '../../../../types/domain';
import {firstRecordValue} from '../../../../utils/dataUtils';

export function getPopupTitle(
  popup: PopupKey,
  selectedLabel: string,
  conversation: ArcadiaRecord | null,
  guest: ArcadiaRecord | null,
  staff: ArcadiaRecord | null,
) {
  if (popup === 'ticketForm') {
    return 'Create Ticket';
  }
  if (popup === 'reservationForm') {
    return 'Create Reservation';
  }
  if (popup === 'ticketDetail') {
    return 'Ticket Detail';
  }
  if (popup === 'reservationDetail') {
    return 'Reservation Detail';
  }
  if (popup === 'checkIn') {
    return 'Guest Check In';
  }
  if (popup === 'checkOut') {
    return 'Guest Check Out';
  }
  if (popup === 'whatsappChat') {
    return (
      firstRecordValue(conversation, ['guest_name', 'contact_name', 'name', 'phone']) ||
      'WhatsApp Chat'
    );
  }
  if (popup === 'guestDetail') {
    return firstRecordValue(guest, ['name', 'guest_name']) || 'Guest Detail';
  }
  if (popup === 'staffProfile') {
    return firstRecordValue(staff, ['name', 'full_name']) || 'Staff Profile';
  }
  if (popup === 'roomForm') {
    return 'Room';
  }
  if (popup === 'profileOption') {
    return selectedLabel || 'Profile';
  }
  return '';
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

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function stageValue(value: string) {
  const normalized = value.toLowerCase().replaceAll(' ', '_');
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
