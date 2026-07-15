import type {ArcadiaRecord} from '../../types/domain';

export type ResourceKey =
  | 'tickets'
  | 'escalations'
  | 'notifications'
  | 'guests'
  | 'reservations'
  | 'rooms'
  | 'orders'
  | 'staff'
  | 'housekeeping'
  | 'whatsapp';

export type ResourceState = {
  loading: boolean;
  error: string | null;
  items: ArcadiaRecord[];
  total?: number;
};

export type ResourceNavItem = {
  key: ResourceKey;
  label: string;
  helper: string;
  icon: string;
};

export type ActionHandler = (
  resource: ResourceKey,
  item: ArcadiaRecord,
  action: string,
) => void;
