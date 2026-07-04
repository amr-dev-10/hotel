import {useEffect, useState} from 'react';
import {Modal, Pressable, ScrollView, Text, View} from 'react-native';

import {styles} from './styles';

export type AppDialogAction = {
  label: string;
  onPress?: () => void;
  tone?: 'primary' | 'secondary';
};

export type AppDialogRequest = {
  title: string;
  message: string;
  details?: string;
  tone?: 'error' | 'success' | 'info';
  actions?: AppDialogAction[];
};

export function appErrorDialog(title: string, details: string): AppDialogRequest {
  const message =
    details
      .split('\n')
      .map(line => line.trim())
      .find(Boolean) || 'The action could not be completed.';

  return {
    details,
    message,
    title,
    tone: 'error',
  };
}

export function AppDialog({
  dialog,
  onClose,
}: {
  dialog: AppDialogRequest | null;
  onClose: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    setDetailsOpen(false);
  }, [dialog]);

  if (!dialog) {
    return null;
  }

  const actions = dialog.actions?.length
    ? dialog.actions
    : [{label: dialog.tone === 'error' ? 'Close' : 'OK'}];

  return (
    <Modal animationType="fade" transparent visible onRequestClose={onClose}>
      <View style={styles.appDialogBackdrop}>
        <View style={styles.appDialogCard}>
          <View
            style={[
              styles.appDialogAccent,
              dialog.tone === 'success' && styles.appDialogAccentSuccess,
              dialog.tone === 'info' && styles.appDialogAccentInfo,
            ]}
          />
          <Text style={styles.appDialogTitle}>{dialog.title}</Text>
          <Text style={styles.appDialogMessage}>{dialog.message}</Text>

          {dialog.details ? (
            <>
              <Pressable
                style={styles.appDialogDetailsButton}
                onPress={() => setDetailsOpen(current => !current)}>
                <Text style={styles.appDialogDetailsButtonText}>
                  {detailsOpen ? 'Hide Details' : 'Details'}
                </Text>
              </Pressable>
              {detailsOpen ? (
                <ScrollView style={styles.appDialogDetailsBox}>
                  <Text style={styles.appDialogDetailsText}>{dialog.details}</Text>
                </ScrollView>
              ) : null}
            </>
          ) : null}

          <View style={styles.appDialogActions}>
            {actions.map(action => (
              <Pressable
                key={action.label}
                style={[
                  styles.appDialogActionButton,
                  action.tone === 'secondary' && styles.appDialogSecondaryButton,
                ]}
                onPress={() => {
                  onClose();
                  action.onPress?.();
                }}>
                <Text
                  style={[
                    styles.appDialogActionText,
                    action.tone === 'secondary' && styles.appDialogSecondaryText,
                  ]}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
