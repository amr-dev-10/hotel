import {useState} from 'react';
import {Text, View} from 'react-native';

import {InfoLine, StatusBadge} from '../../../components/AppComponents';
import {type AppDialogRequest} from '../../../components/AppDialog';
import {firstRecordValue} from '../../../utils/dataUtils';
import {styles} from '../../../theme/styles';

import type {AppData, TicketView} from '../../dashboard';
import type {ResourceKey} from '../types';
import {priorityTone, statusTone} from '../utils';

import type {ArcadiaRecord} from '../../../types/domain';
import {
  LookupField,
  OptionRow,
  PopupActionButton
} from './popup/PopupFields';
import {stageValue} from './popup/popupUtils';
import type {RequestFn} from './popup/popupTypes';

export function TicketDetail({
  data,
  hotelId,
  request,
  ticket,
  onClose,
  onError,
  onRefreshResource,
  onShowDialog,
}: {
  data: AppData;
  hotelId: string;
  request: RequestFn;
  ticket: TicketView;
  onClose: () => void;
  onError: (error: unknown, fallback: string) => void;
  onRefreshResource: (resource: ResourceKey) => void;
  onShowDialog: (dialog: AppDialogRequest) => void;
}) {
  const [stage, setStage] = useState(stageValue(ticket.status));
  const [selectedStaff, setSelectedStaff] = useState<ArcadiaRecord | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function runTicketAction(action: string) {
    setSubmitting(action);
    try {
      await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/tickets/${ticket.id}/${action}`,
        {method: 'POST'},
      );
      onRefreshResource('tickets');
      onShowDialog({
        message: `Action ${action.replaceAll('_', ' ')} completed.`,
        title: 'Ticket updated',
        tone: 'success',
      });
      onClose();
    } catch (error) {
      onError(error, 'Ticket action failed');
    } finally {
      setSubmitting(null);
    }
  }

  async function saveStage() {
    setSubmitting('stage');
    try {
      await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/tickets/${ticket.id}/stage`,
        {
          method: 'PATCH',
          body: JSON.stringify({stage}),
        },
      );
      onRefreshResource('tickets');
      onShowDialog({
        message: stage.replaceAll('_', ' '),
        title: 'Ticket stage updated',
        tone: 'success',
      });
      onClose();
    } catch (error) {
      onError(error, 'Ticket stage update failed');
    } finally {
      setSubmitting(null);
    }
  }

  async function saveAssignment() {
    const staffId = firstRecordValue(selectedStaff, ['id', 'user_id']);
    if (!staffId) {
      onError(new Error('Select a staff member before saving assignment.'), 'Ticket assignment failed');
      return;
    }
    setSubmitting('assign');
    try {
      await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/tickets/${ticket.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({assigned_to: staffId}),
        },
      );
      onRefreshResource('tickets');
      onShowDialog({
        message: firstRecordValue(selectedStaff, ['name', 'email']),
        title: 'Ticket assigned',
        tone: 'success',
      });
      onClose();
    } catch (error) {
      onError(error, 'Ticket assignment failed');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <View>
      <View style={styles.popupBadgeRow}>
        <StatusBadge label={ticket.priority} tone={priorityTone(ticket.priority)} />
        <StatusBadge label={ticket.status} tone={statusTone(ticket.status)} />
      </View>
      <Text style={styles.popupBodyTitle}>{ticket.title}</Text>
      <InfoLine label="Ticket" value={ticket.code} />
      <InfoLine label="Room" value={ticket.roomNumber || 'Unassigned'} />
      <InfoLine label="Guest" value={ticket.guestName || 'Unassigned'} />
      <InfoLine label="Department" value={ticket.department || 'Unassigned'} />
      <InfoLine label="Created" value={ticket.createdAt} />

      <OptionRow
        label="Stage"
        options={[
          ['accepted', 'Accepted'],
          ['in_progress', 'In progress'],
          ['completed', 'Completed'],
          ['approved', 'Approved'],
        ]}
        value={stage}
        onChange={setStage}
      />
      <LookupField
        displayKeys={['name', 'full_name', 'email']}
        label="Assign Staff"
        placeholder="Search staff member"
        records={data.staff}
        selectedRecord={selectedStaff}
        onSelect={setSelectedStaff}
      />
      <View style={styles.popupActions}>
        <PopupActionButton
          label={submitting === 'assign' ? 'Assigning...' : 'Save Assignment'}
          tone="secondary"
          disabled={Boolean(submitting)}
          onPress={saveAssignment}
        />
        <PopupActionButton
          label={submitting === 'stage' ? 'Updating...' : 'Save Stage'}
          disabled={Boolean(submitting)}
          onPress={saveStage}
        />
      </View>
      <View style={styles.popupActions}>
        <PopupActionButton
          label="Accept"
          tone="secondary"
          disabled={Boolean(submitting)}
          onPress={() => runTicketAction('accept')}
        />
        <PopupActionButton
          label="Complete"
          disabled={Boolean(submitting)}
          onPress={() => runTicketAction('complete')}
        />
      </View>
      <View style={styles.popupActions}>
        <PopupActionButton
          label="Approve"
          tone="secondary"
          disabled={Boolean(submitting)}
          onPress={() => runTicketAction('approve')}
        />
        <PopupActionButton
          label="Reopen"
          disabled={Boolean(submitting)}
          onPress={() => runTicketAction('reopen')}
        />
      </View>
    </View>
  );
}
