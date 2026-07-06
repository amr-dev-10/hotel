import type {AppDialogRequest} from '../../../../components/AppDialog';
import type {ApiEnvelope} from '../../../../types/api';
import type {ArcadiaRecord} from '../../../../types/domain';
import type {AppData} from '../../../dashboard';
import type {ResourceKey} from '../../types';

export type ActionButtonTone = 'primary' | 'secondary' | 'success' | 'warning' | 'danger';

export type TicketActivityItem = {
  content: string;
  createdAt: string;
  id: string;
  raw: ArcadiaRecord;
  title: string;
  type: 'event' | 'note';
};

export type RelationLabels = Record<string, string>;

export type TicketWorkflowAction = {
  action?: string;
  body?: Record<string, unknown>;
  key: string;
  label: string;
  loadingLabel: string;
  menuLabel: string;
  note?: string;
  stage?: string;
  tone: ActionButtonTone;
};

export type RequestFn = <T>(
  path: string,
  options?: RequestInit,
) => Promise<ApiEnvelope<T>>;

export type DetailBaseProps = {
  data: AppData;
  error: string | null;
  hotelId: string;
  loading: boolean;
  request: RequestFn;
  onBack: () => void;
  onMenu: () => void;
  onOpenNotifications?: () => void;
  onRefresh: () => void;
  onRefreshResource: (resource: ResourceKey) => void;
  onShowDialog: (dialog: AppDialogRequest) => void;
};
