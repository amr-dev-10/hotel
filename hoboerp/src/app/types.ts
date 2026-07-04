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
  | 'guests'
  | 'housekeeping'
  | 'food'
  | 'kitchen'
  | 'whatsapp'
  | 'assistant'
  | 'staff'
  | 'profile'
  | 'ticketForm'
  | 'ticketDetail'
  | 'reservationDetail'
  | 'guestDetail'
  | 'whatsappChat';

export type PopupKey =
  | 'ticketForm'
  | 'ticketDetail'
  | 'reservationDetail'
  | 'reservationForm'
  | 'checkIn'
  | 'checkOut'
  | 'whatsappChat'
  | 'profileOption'
  | 'staffProfile'
  | 'guestDetail'
  | 'roomForm'
  | null;

export type ScreenAction = (screen: ScreenKey) => void;
