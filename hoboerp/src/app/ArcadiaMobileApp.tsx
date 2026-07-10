import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { login as loginApi, me as meApi } from '../modules/auth/api/auth.api';
import { LoginScreen } from '../modules/auth/screens/LoginScreen';
import {
  buildAppData,
  isScreenLoading,
  screenResourceError,
  type ReservationView,
  type TicketView,
} from '../modules/dashboard';
import { resourceLabels } from '../modules/operations/constants';
import { useOperationsWorkspace } from '../modules/operations/hooks/useOperationsWorkspace';
import type { ResourceKey } from '../modules/operations/types';
import { DispatchModal } from '../modules/ticket/components/DispatchModal';
import { EscalationAlertModal } from '../modules/escalation/components/EscalationAlertModal';
import {
  canOpenScreen,
  canUseAction,
  filterNavItemsForUser,
  requiredPermissionLabel,
} from '../permissions/navigationGuard';
import { apiRequest } from '../services/api';
import {
  SESSION_STORAGE_KEY,
  useAuthStore,
} from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import type { ApiEnvelope } from '../types/api';
import type { ArcadiaRecord, LoginData, Session } from '../types/domain';
import { useMobileWebSocket } from '../services/websocket';
import { BottomNav } from '../components/AppComponents';
import { AppDialog, type AppDialogRequest } from '../components/AppDialog';
import { CustomPopup } from '../modules/operations/components/CustomPopup';
import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Home,
  Hotel,
  MessageCircle,
  Package,
  Ticket,
  Users,
  Utensils,
  Wrench,
} from '../components/icons';
import { buildSideNavItems } from '../navigation/navigationConfig';
import { ScreenContent } from '../modules/operations/screens/ScreenContent';
import {
  registerEscalationPushNotifications,
  unregisterEscalationPushNotifications,
} from '../services/pushNotifications';
import { styles } from '../theme/styles';
import {colors} from '../theme/colors';
import type { PopupKey, ScreenAction, ScreenKey } from '../navigation/types';


const sideNavItems = buildSideNavItems({
  BriefcaseBusiness,
  CalendarDays,
  ClipboardCheck,
  Home,
  Hotel,
  MessageCircle,
  Package,
  Ticket,
  Users,
  Utensils,
  Wrench,
});

const hoboSticker = require('../assets/icons/hobo_splash_sticker.png');

function App(): React.JSX.Element {
  const {width} = useWindowDimensions();
  const wideLayout = width >= 900;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<ScreenKey>('dashboard');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [sessionRestoring, setSessionRestoring] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hotelName, setHotelName] = useState('');
  const [screenStack, setScreenStack] = useState<ScreenKey[]>([]);
  const [popup, setPopup] = useState<PopupKey>(null);
  const [appDialog, setAppDialog] = useState<AppDialogRequest | null>(null);
  const [selectedReservation, setSelectedReservation] =
    useState<ReservationView | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<TicketView | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<ArcadiaRecord | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<ArcadiaRecord | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<ArcadiaRecord | null>(null);
  const [selectedConversation, setSelectedConversation] =
    useState<ArcadiaRecord | null>(null);
  const [selectedLabel, setSelectedLabel] = useState('');
  const lastBackPressRef = useRef(0);
  const clearAuthStore = useAuthStore(state => state.logout);
  const setAuthHotelName = useAuthStore(state => state.setHotelName);
  const setAuthSession = useAuthStore(state => state.setSession);
  const clearNotifications = useNotificationStore(state => state.clear);

  const handleTokenRefresh = useCallback(
    async (login: LoginData) => {
      const token = login.access_token;
      const refreshToken = login.refresh_token;

      if (!token || !refreshToken) {
        throw new Error('Session refresh succeeded but no token was returned.');
      }

      const profile = await meApi(token);

      if (!profile.data?.hotel_id) {
        throw new Error('This account is missing hotel context.');
      }

      const nextSession = {
        accessToken: token,
        refreshToken,
        user: profile.data,
      };
      setSession(nextSession);
      setAuthSession(nextSession);
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
    },
    [setAuthSession],
  );

  const request = useCallback(
    async <T,>(
      path: string,
      options: RequestInit = {},
      token = session?.accessToken,
    ): Promise<ApiEnvelope<T>> => {
      return apiRequest<T>(path, {
        ...options,
        onTokenRefresh: handleTokenRefresh,
        refreshToken: session?.refreshToken,
        token,
      });
    },
    [handleTokenRefresh, session?.accessToken, session?.refreshToken],
  );
  const {
    actionLoading,
    handleAction,
    loadAllResources,
    loadResource,
    resetWorkspace,
    resources,
  } = useOperationsWorkspace(request, session, setAppDialog);

  const loadHotelProfile = useCallback(async (token: string, hotelId: string) => {
    try {
      const hotel = await apiRequest<ArcadiaRecord>(`/api/v1/hotels/${hotelId}`, {
        token,
      });
      const nextHotelName = String(hotel.data?.name ?? hotelId);
      setHotelName(nextHotelName);
      setAuthHotelName(nextHotelName);
    } catch {
      setHotelName(hotelId);
      setAuthHotelName(hotelId);
    }
  }, [setAuthHotelName]);

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      const splashStartedAt = Date.now();

      try {
        const stored = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
        if (!stored) {
          return;
        }

        const nextSession = JSON.parse(stored) as Session;
        if (!nextSession.accessToken || !nextSession.user?.hotel_id) {
          await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
          clearAuthStore();
          return;
        }

        if (mounted) {
          setSession(nextSession);
          setAuthSession(nextSession);
          await Promise.all([
            loadAllResources(nextSession.accessToken, nextSession.user.hotel_id),
            loadHotelProfile(nextSession.accessToken, nextSession.user.hotel_id),
          ]);
        }
      } catch {
        await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
        clearAuthStore();
      } finally {
        const minimumSplashMs = typeof jest === 'undefined' ? 3000 : 0;
        const remainingSplashMs = Math.max(
          0,
          minimumSplashMs - (Date.now() - splashStartedAt),
        );
        if (remainingSplashMs > 0) {
          await new Promise<void>(resolve => setTimeout(() => resolve(), remainingSplashMs));
        }
        if (mounted) {
          setSessionRestoring(false);
        }
      }
    }

    restoreSession();

    return () => {
      mounted = false;
    };
  }, [clearAuthStore, loadAllResources, loadHotelProfile, setAuthSession]);

  const handleLogin = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);

    try {
      const login = await loginApi(email.trim(), password);
      const token = login.data?.access_token;
      const refreshToken = login.data?.refresh_token;

      if (!token || !refreshToken) {
        throw new Error('Login succeeded but no token was returned.');
      }

      const profile = await meApi(token);

      if (!profile.data?.hotel_id) {
        throw new Error('This account is missing hotel context.');
      }

      const nextSession = {accessToken: token, refreshToken, user: profile.data};
      setSession(nextSession);
      setAuthSession(nextSession);
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
      await Promise.all([
        loadAllResources(token, profile.data.hotel_id),
        loadHotelProfile(token, profile.data.hotel_id),
      ]);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setAuthLoading(false);
    }
  }, [email, loadAllResources, loadHotelProfile, password, setAuthSession]);

  const handleLogout = useCallback(() => {
    if (session) {
      unregisterEscalationPushNotifications({
        hotelId: session.user.hotel_id,
        token: session.accessToken,
      }).catch(() => undefined);
    }
    setSession(null);
    clearAuthStore();
    clearNotifications();
    AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    resetWorkspace();
    setScreen('dashboard');
    setScreenStack([]);
    setHotelName('');
    setAuthHotelName(null);
    setDrawerOpen(false);
  }, [clearAuthStore, clearNotifications, resetWorkspace, session, setAuthHotelName]);

  const permissions = session?.user.permissions;

  const showAccessDenied = useCallback(
    (title: string, message: string) => {
      setAppDialog({
        message,
        title,
        tone: 'error',
      });
    },
    [],
  );

  const ensureScreenAllowed = useCallback(
    (nextScreen: ScreenKey) => {
      if (canOpenScreen(permissions, nextScreen)) {
        return true;
      }

      showAccessDenied(
        'Access restricted',
        `Your role needs ${requiredPermissionLabel(nextScreen)} to open this screen.`,
      );
      return false;
    },
    [permissions, showAccessDenied],
  );

  const ensureActionAllowed = useCallback(
    (action: Parameters<typeof canUseAction>[1], label: string) => {
      if (canUseAction(permissions, action)) {
        return true;
      }

      showAccessDenied(
        'Action restricted',
        `Your role does not include permission to ${label}.`,
      );
      return false;
    },
    [permissions, showAccessDenied],
  );

  const openScreen = useCallback<ScreenAction>(nextScreen => {
    if (!ensureScreenAllowed(nextScreen)) {
      return;
    }

    setScreen(nextScreen);
    if (!isDetailScreen(nextScreen)) {
      setScreenStack([]);
    }
    setDrawerOpen(false);
  }, [ensureScreenAllowed]);

  const openDetailScreen = useCallback(
    (nextScreen: ScreenKey) => {
      if (!ensureScreenAllowed(nextScreen)) {
        return;
      }

      setScreenStack(current => [...current, screen]);
      setScreen(nextScreen);
      setDrawerOpen(false);
      setPopup(null);
    },
    [ensureScreenAllowed, screen],
  );

  const handleScreenBack = useCallback(() => {
    if (isDetailScreen(screen)) {
      const previousScreen = screenStack[screenStack.length - 1] ?? fallbackScreen(screen);
      setScreen(previousScreen);
      setScreenStack(current => current.slice(0, -1));
      setDrawerOpen(false);
      return;
    }
    openScreen('dashboard');
  }, [openScreen, screen, screenStack]);

  useEffect(() => {
    if (!session || canOpenScreen(permissions, screen)) {
      return;
    }

    setScreen('dashboard');
    setScreenStack([]);
    setPopup(null);
    showAccessDenied(
      'Access restricted',
      `Your role needs ${requiredPermissionLabel(screen)} to keep this screen open.`,
    );
  }, [permissions, screen, session, showAccessDenied]);

  const closePopup = useCallback(() => {
    setPopup(null);
    setSelectedLabel('');
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (drawerOpen) {
        setDrawerOpen(false);
        return true;
      }
      if (popup) {
        closePopup();
        return true;
      }
      if (screen !== 'dashboard') {
        handleScreenBack();
        return true;
      }

      const now = Date.now();
      if (now - lastBackPressRef.current < 1800) {
        BackHandler.exitApp();
        return true;
      }
      lastBackPressRef.current = now;
      return true;
    });

    return () => subscription.remove();
  }, [closePopup, drawerOpen, handleScreenBack, popup, screen]);

  const openTicketForm = useCallback(() => {
    if (!ensureActionAllowed('createTicket', 'create tickets')) {
      return;
    }

    setSelectedTicket(null);
    setSelectedReservation(null);
    setSelectedConversation(null);
    setSelectedGuest(null);
    openDetailScreen('ticketForm');
  }, [ensureActionAllowed, openDetailScreen]);

  const openContextTicketForm = useCallback(() => {
    if (!ensureActionAllowed('createTicket', 'create tickets')) {
      return;
    }

    setSelectedTicket(null);
    openDetailScreen('ticketForm');
  }, [ensureActionAllowed, openDetailScreen]);

  const openReservationForm = useCallback(() => {
    if (!ensureActionAllowed('createReservation', 'create reservations')) {
      return;
    }

    setSelectedReservation(null);
    setPopup('reservationForm');
  }, [ensureActionAllowed]);

  const openTicketDetail = useCallback((ticket: TicketView) => {
    setSelectedTicket(ticket);
    setSelectedReservation(null);
    setSelectedGuest(null);
    setSelectedConversation(null);
    openDetailScreen('ticketDetail');
  }, [openDetailScreen]);

  const openReservationDetail = useCallback((reservation: ReservationView) => {
    setSelectedReservation(reservation);
    setSelectedGuest(null);
    setSelectedConversation(null);
    openDetailScreen('reservationDetail');
  }, [openDetailScreen]);

  const openRoomForm = useCallback((room: ArcadiaRecord | null) => {
    const action: Parameters<typeof canUseAction>[1] = room
      ? 'updateRoom'
      : 'createRoom';
    const label = room ? 'update rooms' : 'create rooms';
    if (!ensureActionAllowed(action, label)) {
      return;
    }

    setSelectedRoom(room);
    setPopup('roomForm');
  }, [ensureActionAllowed]);

  const openProfileOption = useCallback((label: string) => {
    setSelectedLabel(label);
    setPopup('profileOption');
  }, []);

  const openGuestDetail = useCallback((guest: ArcadiaRecord) => {
    setSelectedGuest(guest);
    setSelectedReservation(null);
    setSelectedConversation(null);
    openDetailScreen('guestDetail');
  }, [openDetailScreen]);

  const openStaffProfile = useCallback((staff: ArcadiaRecord) => {
    if (!ensureActionAllowed('viewStaffProfile', 'view staff profiles')) {
      return;
    }

    setSelectedStaff(staff);
    setPopup('staffProfile');
  }, [ensureActionAllowed]);

  const openWhatsAppChat = useCallback((conversation: ArcadiaRecord) => {
    setSelectedConversation(conversation);
    if (screen !== 'guestDetail') {
      setSelectedGuest(null);
    }
    if (screen !== 'reservationDetail') {
      setSelectedReservation(null);
    }
    setSelectedLabel('');
    openDetailScreen('whatsappChat');
  }, [openDetailScreen, screen]);

  const refreshResource = useCallback(
    (resource: ResourceKey) => {
      loadResource(resource);
    },
    [loadResource],
  );

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    let active = true;
    let cleanup: (() => void) | undefined;
    registerEscalationPushNotifications({
      hotelId: session.user.hotel_id,
      token: session.accessToken,
      userId: session.user.id,
      onEscalationRefresh: () => {
        refreshResource('tickets');
        refreshResource('escalations');
        refreshResource('notifications');
      },
    })
      .then(unsubscribe => {
        if (active) {
          cleanup = unsubscribe;
        } else {
          unsubscribe();
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
      cleanup?.();
    };
  }, [refreshResource, session]);

  const refreshActiveData = useCallback(() => {
    if (screen === 'reservations' || screen === 'reservationDetail') {
      loadResource('reservations');
    }
    if (screen === 'tickets' || screen === 'ticketDetail' || screen === 'ticketForm') {
      loadResource('tickets');
    }
    if (screen === 'escalations') {
      loadResource('escalations');
    }
    if (screen === 'notifications') {
      loadResource('notifications');
    }
    if (screen === 'guests' || screen === 'guestDetail') {
      loadResource('guests');
    }
    if (screen === 'room') {
      loadResource('rooms');
    }
    if (screen === 'kitchen') {
      loadResource('orders');
    }
    if (screen === 'staff') {
      loadResource('staff');
    }
    if (screen === 'housekeeping') {
      loadResource('housekeeping');
    }
    if (screen === 'whatsapp' || screen === 'whatsappChat') {
      loadResource('whatsapp');
    }
  }, [loadResource, screen]);

  useMobileWebSocket({
    hotelId: session?.user.hotel_id,
    onRefreshResource: refreshResource,
    onShowDialog: setAppDialog,
    token: session?.accessToken,
  });

  const appData = useMemo(() => buildAppData(resources), [resources]);
  const loadingProcesses = useMemo(() => {
    const resourceProcesses = (Object.keys(resourceLabels) as ResourceKey[])
      .filter(resource => resources[resource].loading)
      .map(resource => `Loading ${resourceLabels[resource]}`);
    const actionProcess = formatActionLoading(actionLoading);

    return actionProcess ? [...resourceProcesses, actionProcess] : resourceProcesses;
  }, [actionLoading, resources]);
  const activeError = useMemo(
    () => screenResourceError(screen, resources),
    [resources, screen],
  );

  if (sessionRestoring) {
    return <SplashLoadingScreen />;
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <LoginScreen
          email={email}
          password={password}
          error={authError}
          loading={authLoading}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onLogin={handleLogin}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={wideLayout ? 'light-content' : 'dark-content'} />
      <View style={styles.appShell}>
        {wideLayout ? (
          <SideDrawer
            activeScreen={screen}
            hotelName={hotelName || session.user.hotel_id}
            onNavigate={openScreen}
            permissions={permissions}
          />
        ) : null}
        <View style={styles.phoneSurface}>
          <ErrorBoundary key={screen} onShowDialog={setAppDialog}>
            <ScreenContent
              data={appData}
              error={activeError}
              loading={isScreenLoading(screen, resources)}
              loadingProcesses={loadingProcesses}
              request={request}
              screen={screen}
              permissions={permissions}
              selectedConversation={selectedConversation}
              selectedGuest={selectedGuest}
              selectedReservation={selectedReservation}
              selectedTicket={selectedTicket}
              hotelName={hotelName || session.user.hotel_id}
              user={session.user}
              onBack={handleScreenBack}
              onLogout={handleLogout}
              onMenu={() => setDrawerOpen(true)}
              onNavigate={openScreen}
              onOpenProfileOption={openProfileOption}
              onOpenGuest={openGuestDetail}
              onOpenReservation={openReservationDetail}
              onOpenReservationForm={openReservationForm}
              onOpenRoomForm={openRoomForm}
              onOpenStaffProfile={openStaffProfile}
              onOpenTicket={openTicketDetail}
              onOpenContextTicketForm={openContextTicketForm}
              onOpenTicketForm={openTicketForm}
              onOpenWhatsAppChat={openWhatsAppChat}
              onOpenNotifications={() => openScreen('notifications')}
              onQuickRecordAction={handleAction}
              onRefresh={refreshActiveData}
              onRefreshResource={refreshResource}
              onShowDialog={setAppDialog}
            />
          </ErrorBoundary>
          <BottomNav
            activeScreen={screen}
            onCreate={openTicketForm}
            onNavigate={openScreen}
            permissions={permissions}
          />
        </View>
        {!wideLayout ? (
          <Modal
            animationType="fade"
            transparent
            visible={drawerOpen}
            onRequestClose={() => setDrawerOpen(false)}>
            <Pressable
              style={styles.drawerBackdrop}
              onPress={() => setDrawerOpen(false)}>
              <Pressable style={styles.drawerSheet}>
                <SideDrawer
                  activeScreen={screen}
                  hotelName={hotelName || session.user.hotel_id}
                  onNavigate={openScreen}
                  permissions={permissions}
                />
              </Pressable>
            </Pressable>
          </Modal>
        ) : null}
        <CustomPopup
          popup={popup}
          reservation={selectedReservation}
          room={selectedRoom}
          selectedLabel={selectedLabel}
          ticket={selectedTicket}
          data={appData}
          guest={selectedGuest}
          hotelName={hotelName || session.user.hotel_id}
          user={session.user}
          conversation={selectedConversation}
          request={request}
          staff={selectedStaff}
          onCheckIn={() => setPopup('checkIn')}
          onCheckOut={() => setPopup('checkOut')}
          onClose={closePopup}
          onCreateTicket={openContextTicketForm}
          onOpenWhatsAppConversation={openWhatsAppChat}
          onRefreshResource={refreshResource}
          onReservationBack={() => setPopup('reservationDetail')}
          onShowDialog={setAppDialog}
        />
        <AppDialog dialog={appDialog} onClose={() => setAppDialog(null)} />
        <EscalationAlertModal onOpenEscalations={() => openScreen('escalations')} />
        <DispatchModal
          hotelId={session.user.hotel_id}
          onRefreshResource={refreshResource}
          onShowDialog={setAppDialog}
          token={session.accessToken}
        />
      </View>
    </SafeAreaView>
  );
}

function SplashLoadingScreen() {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (typeof jest !== 'undefined') {
      return undefined;
    }

    const animation = Animated.loop(
      Animated.timing(rotation, {
        duration: 1400,
        easing: Easing.linear,
        toValue: 1,
        useNativeDriver: true,
      }),
    );

    animation.start();
    return () => animation.stop();
  }, [rotation]);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView style={styles.splashSafeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.splash} />
      <View style={styles.splashScreen}>
        <View style={styles.splashCenter}>
          <View style={styles.splashLogoOrbit}>
            <Animated.View style={[styles.splashRing, {transform: [{rotate}]}]}>
              <View style={styles.splashRingDot} />
            </Animated.View>
            <View style={styles.splashLogoPlate}>
              <Image
                source={hoboSticker}
                resizeMode="contain"
                style={styles.splashLogoImage}
              />
            </View>
          </View>
          <Text style={styles.splashTitle}>HOBO ERP</Text>
          <Text style={styles.splashSubtitle}>SMART BUSINESS SOLUTION</Text>
        </View>
        {/* <Text style={styles.splashLoadingText}>LOADING...</Text> */}
      </View>
    </SafeAreaView>
  );
}

function SideDrawer({
  activeScreen,
  hotelName,
  onNavigate,
  permissions,
}: {
  activeScreen: ScreenKey;
  hotelName: string;
  onNavigate: ScreenAction;
  permissions?: string[];
}) {
  const visibleItems = filterNavItemsForUser(sideNavItems, permissions);

  return (
    <View style={styles.sideDrawer}>
      <View style={styles.drawerBrand}>
        <View style={styles.drawerBrandIcon}>
          <Hotel color={colors.white} size={25} strokeWidth={2.2} />
        </View>
        <View>
          <Text style={styles.drawerBrandTitle}>Arcadia Hotel</Text>
          <Text style={styles.drawerBrandSub}>Management</Text>
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.drawerNav}>
        {visibleItems.map(item => {
          const active = item.key === activeScreen;
          const Icon = item.icon;
          return (
            <Pressable
              key={`${item.key}-${item.label}`}
              style={[styles.drawerNavItem, active && styles.activeDrawerNavItem]}
              onPress={() => onNavigate(item.key)}>
              <Icon color={colors.white} size={19} strokeWidth={2} />
              <Text style={styles.drawerNavText}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.drawerHotel}>
        <View style={styles.drawerHotelIcon}>
          <Hotel color={colors.white} size={24} strokeWidth={2} />
        </View>
        <View style={styles.drawerHotelText}>
          <Text style={styles.drawerHotelLabel}>Current Hotel</Text>
          <Text style={styles.drawerHotelName}>{hotelName}</Text>
        </View>
        <ChevronRight color={colors.white} size={16} strokeWidth={2} />
      </View>
    </View>
  );
}

function isDetailScreen(screen: ScreenKey) {
  return ['ticketForm', 'ticketDetail', 'reservationDetail', 'guestDetail', 'whatsappChat'].includes(screen);
}

function fallbackScreen(screen: ScreenKey): ScreenKey {
  if (screen === 'ticketForm') {
    return 'tickets';
  }
  if (screen === 'ticketDetail') {
    return 'tickets';
  }
  if (screen === 'reservationDetail') {
    return 'reservations';
  }
  if (screen === 'guestDetail') {
    return 'guests';
  }
  if (screen === 'whatsappChat') {
    return 'whatsapp';
  }
  return 'dashboard';
}

function formatActionLoading(actionLoading: string | null) {
  if (!actionLoading) {
    return null;
  }

  const [resource, , action] = actionLoading.split(':');
  const actionLabels: Record<string, string> = {
    accept: 'Accepting',
    approve: 'Approving',
    complete: 'Completing',
    delete: 'Deleting',
    reject: 'Rejecting',
    reopen: 'Reopening',
    preparing: 'Moving to preparing',
    ready: 'Marking ready',
    delivered: 'Marking delivered',
    cancelled: 'Cancelling',
  };
  const actionLabel = actionLabels[action] ?? `Running ${action.replace(/[-_]/g, ' ')}`;

  return `${actionLabel} ${singularResourceName(resource as ResourceKey)}`;
}

function singularResourceName(resource: ResourceKey) {
  if (resource === 'orders') {
    return 'order';
  }
  if (resource === 'housekeeping') {
    return 'task';
  }
  if (resource === 'whatsapp') {
    return 'conversation';
  }

  const label = resourceLabels[resource] ?? 'record';
  return label.endsWith('s') ? label.slice(0, -1).toLowerCase() : label.toLowerCase();
}

export default App;
