import {useEffect} from 'react';
import {Modal, Pressable, Text, Vibration, View} from 'react-native';

import {styles} from '../../../theme/styles';
import {useNotificationStore} from '../../../store/notificationStore';

export function EscalationAlertModal({
  onOpenEscalations,
}: {
  onOpenEscalations: () => void;
}) {
  const alert = useNotificationStore(state => state.activeEscalationAlert);
  const clearAlert = useNotificationStore(state => state.clearEscalationAlert);
  const alertId = alert?.id;

  useEffect(() => {
    if (!alertId) {
      return undefined;
    }

    Vibration.vibrate([0, 380, 160, 380, 160, 520]);
    return () => Vibration.cancel();
  }, [alertId]);

  if (!alert) {
    return null;
  }

  return (
    <Modal animationType="fade" transparent visible onRequestClose={clearAlert}>
      <View style={styles.dispatchBackdrop}>
        <View style={styles.dispatchCard}>
          <View style={styles.dispatchHeader}>
            <View style={styles.escalationAlertPulse}>
              <Text style={styles.escalationAlertPulseText}>!</Text>
            </View>
            <View style={styles.dispatchHeaderText}>
              <Text style={styles.dispatchEyebrow}>Escalation Alert</Text>
              <Text style={styles.dispatchTitle}>{alert.title}</Text>
            </View>
            <Pressable style={styles.dispatchCloseButton} onPress={clearAlert}>
              <Text style={styles.dispatchCloseText}>X</Text>
            </Pressable>
          </View>

          <Text style={styles.dispatchDescription}>{alert.message}</Text>

          <View style={styles.dispatchInfoGrid}>
            <InfoBox label="Room" value={alert.room_number ? `Room ${alert.room_number}` : 'Not set'} />
            <InfoBox label="Priority" value={alert.priority ? `P${alert.priority}` : 'High'} />
            <InfoBox label="Ticket" value={compactId(alert.ticket_id) || 'Open queue'} />
          </View>

          <View style={styles.dispatchTimer}>
            <Text style={styles.dispatchTimerText}>
              New escalation needs acknowledgement in the operations queue.
            </Text>
          </View>

          <View style={styles.dispatchActions}>
            <Pressable
              style={[styles.dispatchActionButton, styles.dispatchAcceptButton]}
              onPress={() => {
                clearAlert();
                onOpenEscalations();
              }}>
              <Text style={styles.dispatchAcceptText}>Open Escalations</Text>
            </Pressable>
            <Pressable
              style={[styles.dispatchActionButton, styles.dispatchRejectButton]}
              onPress={clearAlert}>
              <Text style={styles.dispatchRejectText}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function InfoBox({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.dispatchInfoBox}>
      <Text style={styles.dispatchInfoLabel}>{label}</Text>
      <Text style={styles.dispatchInfoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function compactId(value?: string | null) {
  if (!value) {
    return '';
  }

  return value.length <= 8 ? value : value.slice(0, 8);
}
