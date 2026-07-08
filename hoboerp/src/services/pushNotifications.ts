import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import {PermissionsAndroid, Platform} from 'react-native';

import {apiRequest} from './api';
import {
  type AppNotification,
  type EscalationAlertState,
  useNotificationStore,
} from '../store/notificationStore';

type PushRegistrationOptions = {
  hotelId: string;
  onEscalationRefresh?: () => void;
  token: string;
  userId: string;
};

const registeredTokenKey = '@hoboerp:last-fcm-token';

export function setEscalationBackgroundMessageHandler() {
  try {
    messaging().setBackgroundMessageHandler(async () => undefined);
  } catch {
    // Firebase config is optional in local builds.
  }
}

export async function registerEscalationPushNotifications({
  hotelId,
  onEscalationRefresh,
  token,
  userId,
}: PushRegistrationOptions) {
  const allowed = await requestNotificationPermission();
  if (!allowed) {
    return () => undefined;
  }

  await messaging().registerDeviceForRemoteMessages();
  const fcmToken = await messaging().getToken();
  await registerFcmToken(hotelId, userId, token, fcmToken);

  const unsubscribeTokenRefresh = messaging().onTokenRefresh(nextToken => {
    registerFcmToken(hotelId, userId, token, nextToken).catch(() => undefined);
  });
  const unsubscribeMessage = messaging().onMessage(message => {
    handleForegroundMessage(message, onEscalationRefresh);
  });

  return () => {
    unsubscribeMessage();
    unsubscribeTokenRefresh();
  };
}

export async function unregisterEscalationPushNotifications({
  hotelId,
  token,
}: {
  hotelId: string;
  token: string;
}) {
  const fcmToken = await messaging().getToken();
  await apiRequest(
    `/api/v1/hotels/${hotelId}/notifications/fcm-token?token=${encodeURIComponent(fcmToken)}`,
    {
      method: 'DELETE',
      token,
    },
  );
  await AsyncStorage.removeItem(registeredTokenKey);
}

async function requestNotificationPermission() {
  if (Platform.OS === 'android') {
    if (Number(Platform.Version) < 33) {
      return true;
    }

    const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    const result = await PermissionsAndroid.request(permission);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  const status = await messaging().requestPermission();
  return (
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL
  );
}

async function registerFcmToken(
  hotelId: string,
  userId: string,
  authToken: string,
  fcmToken: string,
) {
  const storageValue = `${hotelId}:${userId}:${fcmToken}`;
  if ((await AsyncStorage.getItem(registeredTokenKey)) === storageValue) {
    return;
  }

  await apiRequest(`/api/v1/hotels/${hotelId}/notifications/fcm-token`, {
    method: 'POST',
    token: authToken,
    body: JSON.stringify({
      platform: Platform.OS,
      token: fcmToken,
    }),
  });
  await AsyncStorage.setItem(registeredTokenKey, storageValue);
}

function handleForegroundMessage(
  message: FirebaseMessagingTypes.RemoteMessage,
  onEscalationRefresh?: () => void,
) {
  const notification = appNotificationFromRemoteMessage(message);
  if (notification) {
    useNotificationStore.getState().addNotification(notification);
  }

  const alert = escalationAlertFromRemoteMessage(message, notification);
  if (!alert) {
    return;
  }

  useNotificationStore.getState().setActiveEscalationAlert(alert);
  onEscalationRefresh?.();
}

function appNotificationFromRemoteMessage(
  message: FirebaseMessagingTypes.RemoteMessage,
): AppNotification | null {
  const id =
    stringValue(message.data?.notification_id) ??
    message.messageId ??
    stringValue(message.data?.ticket_id) ??
    null;
  if (!id) {
    return null;
  }

  return {
    id,
    created_at: new Date().toISOString(),
    message:
      message.notification?.body ??
      stringValue(message.data?.message) ??
      stringValue(message.data?.body) ??
      null,
    metadata: message.data ?? {},
    status: 'pending',
    title:
      message.notification?.title ??
      stringValue(message.data?.title) ??
      'New notification',
    notification_type: stringValue(message.data?.notification_type),
    type:
      stringValue(message.data?.notification_type) ??
      stringValue(message.data?.type) ??
      null,
  };
}

function escalationAlertFromRemoteMessage(
  message: FirebaseMessagingTypes.RemoteMessage,
  notification: AppNotification | null,
): EscalationAlertState | null {
  const type = String(
    stringValue(message.data?.notification_type) ??
      stringValue(message.data?.type) ??
      notification?.type ??
      '',
  ).toLowerCase();
  const event = String(stringValue(message.data?.event) ?? '').toLowerCase();
  if (!type.includes('escalation') && !event.includes('escalat')) {
    return null;
  }

  const id =
    notification?.id ??
    stringValue(message.data?.notification_id) ??
    message.messageId ??
    stringValue(message.data?.ticket_id) ??
    `escalation-${Date.now()}`;
  return {
    id,
    created_at: notification?.created_at ?? new Date().toISOString(),
    message:
      notification?.message ??
      message.notification?.body ??
      stringValue(message.data?.message) ??
      'A ticket escalation needs attention.',
    priority: stringValue(message.data?.priority),
    room_number: stringValue(message.data?.room_number),
    ticket_id:
      stringValue(message.data?.ticket_id) ??
      stringValue(message.data?.reference_id),
    title:
      notification?.title ??
      message.notification?.title ??
      stringValue(message.data?.title) ??
      'New escalation',
  };
}

function stringValue(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text || null;
}
