import type {ComponentType} from 'react';

export type IconComponent = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

export type ScreenKey =
  | 'dashboard'
  | 'reservations'
  | 'room'
  | 'tickets'
  | 'escalations'
  | 'notifications'
  | 'housekeeping'
  | 'food'
  | 'kitchen'
  | 'whatsapp'
  | 'assistant'
  | 'staff'
  | 'profile';

export type PopupKey =
  | 'ticketForm'
  | 'ticketDetail'
  | 'reservationDetail'
  | 'checkIn'
  | 'checkOut'
  | 'whatsappChat'
  | 'profileOption'
  | 'staffProfile'
  | 'roomForm'
  | null;

export type ScreenAction = (screen: ScreenKey) => void;
