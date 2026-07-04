import type {IconComponent, ScreenKey} from './types';

export type AppNavItem = {
  key: ScreenKey;
  label: string;
  icon: IconComponent;
};

export function buildSideNavItems(icons: {
  BriefcaseBusiness: IconComponent;
  CalendarDays: IconComponent;
  ClipboardCheck: IconComponent;
  Home: IconComponent;
  Hotel: IconComponent;
  MessageCircle: IconComponent;
  Package: IconComponent;
  Ticket: IconComponent;
  Users: IconComponent;
  Utensils: IconComponent;
  Wrench: IconComponent;
}): AppNavItem[] {
  return [
    {key: 'dashboard', label: 'Overview', icon: icons.Home},
    {key: 'staff', label: 'Staff Portal', icon: icons.Users},
    {key: 'tickets', label: 'Tickets', icon: icons.Ticket},
    {key: 'escalations', label: 'Escalations', icon: icons.Wrench},
    {key: 'guests', label: 'Guests', icon: icons.Users},
    {key: 'reservations', label: 'Reservations', icon: icons.CalendarDays},
    {key: 'room', label: 'Rooms', icon: icons.Hotel},
    {key: 'food', label: 'F&B', icon: icons.Utensils},
    {key: 'kitchen', label: 'Kitchen', icon: icons.Package},
    {key: 'housekeeping', label: 'Housekeeping', icon: icons.ClipboardCheck},
    {key: 'staff', label: 'Hierarchy', icon: icons.BriefcaseBusiness},
    {key: 'whatsapp', label: 'WhatsApp', icon: icons.MessageCircle},
  ];
}

export function buildBottomTabs(icons: {
  Home: IconComponent;
  Plus: IconComponent;
  Search: IconComponent;
  User: IconComponent;
  Wrench: IconComponent;
}): AppNavItem[] {
  return [
    {key: 'dashboard', label: 'Home', icon: icons.Home},
    {key: 'reservations', label: 'Search', icon: icons.Search},
    {key: 'assistant', label: '', icon: icons.Plus},
    {key: 'escalations', label: 'Escalations', icon: icons.Wrench},
    {key: 'profile', label: 'Profile', icon: icons.User},
  ];
}
