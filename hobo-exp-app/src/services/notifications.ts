/**
 * On-device notification setup.
 *
 * REMOTE pushes (so notifications + ringtone arrive when the app is CLOSED) are
 * now sent server-side by Cloud Functions (see /functions) on the Firebase
 * project — they trigger on the same RTDB writes the app/bot already make and
 * deliver via FCM through the loud `tasks-high` channel below. The old
 * client-side relay (arcadiaapi.club) is gone; the app no longer sends pushes.
 *
 * This file keeps only what must live on the device:
 *   • ensureTasksChannel        — the loud Android channel (sound/vibration)
 *   • setupNotificationHandlers — foreground display + tap routing
 *   • registerPushToken         — store this device's FCM token for the server
 *   • presentLocalEscalationNotification — foreground-only local alert
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ref as dbRef, set } from 'firebase/database';
import { rtdb } from './firebaseConfig';
import { TenantManager } from './tenant';

// Android needs a dedicated channel with MAX importance, vibration, and a
// custom loud sound for new-task pushes to ring the way the user expects.
// The Cloud Function targets this exact channel id so a closed app rings.
// On iOS, "criticalAlert" needs an Apple entitlement; without it iOS plays
// the standard tone — that's a deploy-config concern, not code.
const TASKS_CHANNEL_ID = 'tasks-high';

async function ensureTasksChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(TASKS_CHANNEL_ID, {
      name: 'New Tasks',
      description: 'Loud ringtone for new task assignments',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 700, 400, 700, 400],
      lightColor: '#0052CC',
      sound: 'ringtone',  // strips extension; must match assets/sounds/ringtone.mp3 wired via expo-notifications plugin
      enableVibrate: true,
      bypassDnd: false,
    });
  } catch (e) {
    console.warn('[Notifications] failed to register tasks channel:', e);
  }
}

/**
 * Show a local (on-device) notification immediately — used for escalation
 * alerts while the app is in the FOREGROUND. (Closed-app alerts come from the
 * server-side Cloud Function via FCM.) Routed through the loud `tasks-high`
 * channel so it carries the ringtone + vibration treatment.
 */
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
        sound: 'ringtone', // channel also carries vibration + light treatment
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: { event: 'escalation' },
      },
      // On Android, deliver immediately on the loud "tasks-high" channel.
      // On iOS there are no channels — `null` delivers now.
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
  // Fire-and-forget — channel registration is idempotent and non-fatal.
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

/**
 * Register THIS device's native FCM token so the server-side Cloud Function can
 * push to it. Stored at {hotelId}/FcmToken/{employeeId}. Requires the build to
 * carry google-services.json (FCM config) — without it getDevicePushTokenAsync
 * throws and no token is stored.
 */
export async function registerPushToken(employeeId: string) {
  const permission = await Notifications.getPermissionsAsync();
  let status = permission.status;

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== 'granted') {
    return null;
  }

  const token = await Notifications.getDevicePushTokenAsync();
  const pushToken = token?.data ?? null;
  if (!pushToken) {
    return null;
  }

  await set(dbRef(rtdb, `${TenantManager.rtdbPath('FcmToken')}/${employeeId}`), {
    FcmToken: pushToken,
  });

  return pushToken;
}
