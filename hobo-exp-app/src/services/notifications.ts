/**
 * On-device notification setup.
 *
 * The app is fully REST API backed. This file only manages local notification
 * behavior for alerts shown while the app is running.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const TASKS_CHANNEL_ID = 'tasks-high';

async function ensureTasksChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(TASKS_CHANNEL_ID, {
      name: 'New Tasks',
      description: 'Loud ringtone for local task alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 700, 400, 700, 400],
      lightColor: '#0052CC',
      sound: 'ringtone',
      enableVibrate: true,
      bypassDnd: false,
    });
  } catch (e) {
    console.warn('[Notifications] failed to register tasks channel:', e);
  }
}

export async function presentLocalEscalationNotification(
  title: string,
  body: string,
): Promise<void> {
  try {
    await ensureTasksChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'ringtone',
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: { event: 'escalation' },
      },
      trigger: Platform.OS === 'android' ? { channelId: TASKS_CHANNEL_ID } : null,
    });
  } catch (e) {
    console.warn('[Notifications] presentLocalEscalationNotification failed:', e);
  }
}

type TaskNotificationPayload = {
  taskId?: string;
  event?: string;
};

export function setupNotificationHandlers(onTaskEvent?: (payload: TaskNotificationPayload) => void) {
  void ensureTasksChannel();

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    const data = (notification.request.content.data ?? {}) as TaskNotificationPayload;
    if (data.taskId || data.event) {
      onTaskEvent?.(data);
    }
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = (response.notification.request.content.data ?? {}) as TaskNotificationPayload;
    if (data.taskId || data.event) {
      onTaskEvent?.(data);
    }
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}
