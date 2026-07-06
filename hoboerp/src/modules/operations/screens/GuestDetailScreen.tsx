import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import {Text,
  View} from 'react-native';

import {
  Avatar,
  EmptyState,
  InfoLine
} from '../../../components/AppComponents';
import {appErrorDialog} from '../../../components/AppDialog';

import {firstRecordValue,
  isRecordTruthy} from '../../../utils/dataUtils';
import {styles} from '../../../theme/styles';

import {compactDate} from '../utils';
import {formatErrorDetails} from '../../../services/api';

import type {ArcadiaRecord} from '../../../types/domain';
import {
  ActionButton,
  ActionRow,
  DetailFrame,
  DetailSection,
  InlineError,
  OptionRow,
  RecordFields,
  TimelineSection
} from './detail/DetailLayout';

import type {DetailBaseProps} from './detail/detailTypes';
import {
  actionProcessLabel,
  titleCase
} from './detail/detailUtils';

export function GuestDetailScreen({
  error,
  hotelId,
  loading,
  request,
  guest,
  onBack,
  onCreateTicket,
  onMenu,
  onOpenNotifications,
  onOpenWhatsAppConversation,
  onRefresh,
  onRefreshResource,
  onShowDialog,
}: DetailBaseProps & {
  guest: ArcadiaRecord | null;
  onCreateTicket: () => void;
  onOpenWhatsAppConversation: (conversation: ArcadiaRecord) => void;
}) {
  const guestId = firstRecordValue(guest, ['id', 'guest_id']);
  const [detail, setDetail] = useState<ArcadiaRecord | null>(null);
  const [consent, setConsent] = useState<ArcadiaRecord | null>(null);
  const [timeline, setTimeline] = useState<ArcadiaRecord[]>([]);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const record = useMemo(() => ({...(guest ?? {}), ...(detail ?? {})}), [detail, guest]);
  const name = firstRecordValue(record, ['name', 'guest_name', 'email']) || 'Guest';

  const loadDetail = useCallback(async () => {
    if (!guestId) {
      return;
    }
    setDetailLoading(true);
    setInlineError(null);
    const [detailResult, consentResult, timelineResult] = await Promise.allSettled([
      request<ArcadiaRecord>(`/api/v1/hotels/${hotelId}/guests/${guestId}`),
      request<ArcadiaRecord | null>(`/api/v1/hotels/${hotelId}/guests/${guestId}/consent`),
      request<ArcadiaRecord[]>(`/api/v1/hotels/${hotelId}/guests/${guestId}/timeline`),
    ]);

    if (detailResult.status === 'fulfilled' && detailResult.value.data) {
      setDetail(detailResult.value.data);
    } else if (detailResult.status === 'rejected') {
      setInlineError(formatErrorDetails(detailResult.reason, 'Guest detail failed'));
    }
    if (consentResult.status === 'fulfilled') {
      setConsent(consentResult.value.data ?? null);
    }
    if (timelineResult.status === 'fulfilled') {
      setTimeline(Array.isArray(timelineResult.value.data) ? timelineResult.value.data : []);
    }
    setDetailLoading(false);
  }, [guestId, hotelId, request]);

  useEffect(() => {
    setDetail(null);
    setConsent(null);
    setTimeline([]);
    loadDetail();
  }, [loadDetail]);

  const handleError = useCallback((nextError: unknown, fallback: string) => {
    const details = formatErrorDetails(nextError, fallback);
    setInlineError(details);
    onShowDialog(appErrorDialog(fallback, details));
  }, [onShowDialog]);

  async function openWhatsApp() {
    if (!guestId) {
      handleError(new Error('Guest ID is missing.'), 'WhatsApp conversation failed');
      return;
    }
    setSubmitting('whatsapp');
    try {
      const result = await request<{conversation_id: string; reservation_id: string | null}>(
        `/api/v1/hotels/${hotelId}/guests/${guestId}/conversation`,
      );
      if (!result.data?.conversation_id) {
        throw new Error('Conversation was not returned by the API.');
      }
      onOpenWhatsAppConversation({
        id: result.data.conversation_id,
        conversation_id: result.data.conversation_id,
        guest_id: guestId,
        guest_name: name,
        phone: firstRecordValue(record, ['whatsapp_phone', 'phone']),
        reservation_id: result.data.reservation_id,
        status: 'open',
      });
    } catch (nextError) {
      handleError(nextError, 'WhatsApp conversation failed');
    } finally {
      setSubmitting(null);
    }
  }

  async function updateGuestStatus(status: string) {
    if (!guestId) {
      return;
    }
    setSubmitting(status);
    try {
      await request<ArcadiaRecord>(
        `/api/v1/hotels/${hotelId}/guests/${guestId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({status}),
        },
      );
      onRefreshResource('guests');
      await loadDetail();
      onShowDialog({
        message: `Status changed to ${titleCase(status)}.`,
        title: 'Guest updated',
        tone: 'success',
      });
    } catch (nextError) {
      handleError(nextError, 'Guest update failed');
    } finally {
      setSubmitting(null);
    }
  }

  if (!guest) {
    return (
      <DetailFrame error={error} loading={loading} title="Guest Detail" onBack={onBack} onMenu={onMenu} onOpenNotifications={onOpenNotifications} onRefresh={onRefresh}>
        <EmptyState label="No guest selected." />
      </DetailFrame>
    );
  }

  return (
    <DetailFrame
      error={error}
      loading={loading || detailLoading || Boolean(submitting)}
      loadingLabel={actionProcessLabel('guest', submitting, 'Loading guest detail')}
      title="Guest Detail"
      onBack={onBack}
      onMenu={onMenu}
      onOpenNotifications={onOpenNotifications}
      onRefresh={loadDetail}>
      <InlineError message={inlineError} />
      <View style={styles.staffPopupHeader}>
        <Avatar label={name.charAt(0)} size={52} />
        <View>
          <Text style={styles.popupBodyTitle}>{name}</Text>
          <Text style={styles.caption}>
            {firstRecordValue(record, ['whatsapp_phone', 'phone', 'email']) || 'No contact saved'}
          </Text>
        </View>
      </View>

      <DetailSection title="Guest Summary">
        <InfoLine label="Status" value={firstRecordValue(record, ['status']) || 'Guest'} />
        <InfoLine label="Phone" value={firstRecordValue(record, ['phone']) || 'No phone'} />
        <InfoLine label="WhatsApp" value={firstRecordValue(record, ['whatsapp_phone']) || 'No WhatsApp'} />
        <InfoLine label="Email" value={firstRecordValue(record, ['email']) || 'No email'} />
        <InfoLine label="Check-in" value={compactDate(firstRecordValue(record, ['check_in_date'])) || 'Not set'} />
        <InfoLine label="Check-out" value={compactDate(firstRecordValue(record, ['check_out_date'])) || 'Not set'} />
        <InfoLine label="Reservations" value={firstRecordValue(record, ['reservation_count']) || '0'} />
        <InfoLine label="Conversation" value={isRecordTruthy(record, ['has_whatsapp_conversation']) ? 'Linked' : 'Create or link'} />
      </DetailSection>

      <DetailSection title="Smart Actions">
        <ActionRow>
          <ActionButton disabled={Boolean(submitting)} label={submitting === 'whatsapp' ? 'Opening...' : 'Open WhatsApp'} tone="secondary" onPress={openWhatsApp} />
          <ActionButton disabled={Boolean(submitting)} label="Create Ticket" onPress={onCreateTicket} />
        </ActionRow>
        <OptionRow
          label="Guest Status"
          options={[
            ['pre_arrival', 'Pre arrival'],
            ['checked_in', 'Checked in'],
            ['checked_out', 'Checked out'],
          ]}
          value={firstRecordValue(record, ['status'])}
          onChange={updateGuestStatus}
        />
      </DetailSection>

      {consent ? <RecordFields record={consent} title="Consent" /> : null}
      <TimelineSection items={timeline} title="Guest Timeline" />
      <RecordFields record={record} title="Backend API Fields" />
    </DetailFrame>
  );
}
