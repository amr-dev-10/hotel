import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ErrorBoundary} from '../components/ErrorBoundary';
import {AppDialog, type AppDialogRequest} from './AppDialog';
import {CustomPopup} from './CustomPopup';
import {ScreenContent} from './screens/OperationsScreens';
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
  Utensils,
  Users,
  Wrench,
} from './icons';
import {BottomNav} from './AppComponents';
import {buildSideNavItems} from './navigationConfig';
import {styles} from './styles';
import type {PopupKey, ScreenAction, ScreenKey} from './types';
import {
  buildAppData,
  isScreenLoading,
  screenResourceError,
  type ReservationView,
  type TicketView,
} from '../modules/dashboard';
import type {ResourceKey} from '../modules/operations/types';
import {login as loginApi, me as meApi} from '../modules/auth/api/auth.api';
import {LoginScreen} from '../modules/auth/screens/LoginScreen';
import {useOperationsWorkspace} from '../modules/operations/hooks/useOperationsWorkspace';
import {apiRequest} from '../services/api';
import type {ApiEnvelope} from '../types/api';
import type {ArcadiaRecord, Session} from '../types/domain';

const SESSION_STORAGE_KEY = 'hoboerp.session.v1';


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

  const request = useCallback(
    async <T,>(
      path: string,
      options: RequestInit = {},
      token = session?.accessToken,
    ): Promise<ApiEnvelope<T>> => {
      return apiRequest<T>(path, {...options, token});
    },
    [session?.accessToken],
  );
  const {loadAllResources, loadResource, resetWorkspace, resources} =
    useOperationsWorkspace(request, session, setAppDialog);

  const loadHotelProfile = useCallback(async (token: string, hotelId: string) => {
    try {
      const hotel = await apiRequest<ArcadiaRecord>(`/api/v1/hotels/${hotelId}`, {
        token,
      });
      setHotelName(String(hotel.data?.name ?? hotelId));
    } catch {
      setHotelName(hotelId);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      try {
        const stored = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
        if (!stored) {
          return;
        }

        const nextSession = JSON.parse(stored) as Session;
        if (!nextSession.accessToken || !nextSession.user?.hotel_id) {
          await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
          return;
        }

        if (mounted) {
          setSession(nextSession);
          await Promise.all([
            loadAllResources(nextSession.accessToken, nextSession.user.hotel_id),
            loadHotelProfile(nextSession.accessToken, nextSession.user.hotel_id),
          ]);
        }
      } catch {
        await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
      } finally {
        if (mounted) {
          setSessionRestoring(false);
        }
      }
    }

    restoreSession();

    return () => {
      mounted = false;
    };
  }, [loadAllResources, loadHotelProfile]);

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
  }, [email, loadAllResources, loadHotelProfile, password]);

  const handleLogout = useCallback(() => {
    setSession(null);
    AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    resetWorkspace();
    setScreen('dashboard');
    setScreenStack([]);
    setHotelName('');
    setDrawerOpen(false);
  }, [resetWorkspace]);

  const openScreen = useCallback<ScreenAction>(nextScreen => {
    setScreen(nextScreen);
    if (!isDetailScreen(nextScreen)) {
      setScreenStack([]);
    }
    setDrawerOpen(false);
  }, []);

  const openDetailScreen = useCallback(
    (nextScreen: ScreenKey) => {
      setScreenStack(current => [...current, screen]);
      setScreen(nextScreen);
      setDrawerOpen(false);
      setPopup(null);
    },
    [screen],
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
    setSelectedTicket(null);
    setSelectedReservation(null);
    setSelectedConversation(null);
    setSelectedGuest(null);
    openDetailScreen('ticketForm');
  }, [openDetailScreen]);

  const openContextTicketForm = useCallback(() => {
    setSelectedTicket(null);
    openDetailScreen('ticketForm');
  }, [openDetailScreen]);

  const openReservationForm = useCallback(() => {
    setSelectedReservation(null);
    setPopup('reservationForm');
  }, []);

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
    setSelectedRoom(room);
    setPopup('roomForm');
  }, []);

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
    setSelectedStaff(staff);
    setPopup('staffProfile');
  }, []);

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
    if (screen === 'food') {
      loadResource('orders');
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

  const appData = useMemo(() => buildAppData(resources), [resources]);
  const activeError = useMemo(
    () => screenResourceError(screen, resources),
    [resources, screen],
  );

  if (sessionRestoring) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <View style={styles.restoreSessionState}>
          <Text style={styles.emptyStateText}>Restoring session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
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
          />
        ) : null}
        <View style={styles.phoneSurface}>
          <ErrorBoundary key={screen} onShowDialog={setAppDialog}>
            <ScreenContent
              data={appData}
              error={activeError}
              loading={isScreenLoading(screen, resources)}
              request={request}
              screen={screen}
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
              onRefresh={refreshActiveData}
              onRefreshResource={refreshResource}
              onShowDialog={setAppDialog}
            />
          </ErrorBoundary>
          <BottomNav
            activeScreen={screen}
            onCreate={openTicketForm}
            onNavigate={openScreen}
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
      </View>
    </SafeAreaView>
  );
}

function SideDrawer({
  activeScreen,
  hotelName,
  onNavigate,
}: {
  activeScreen: ScreenKey;
  hotelName: string;
  onNavigate: ScreenAction;
}) {
  return (
    <View style={styles.sideDrawer}>
      <View style={styles.drawerBrand}>
        <View style={styles.drawerBrandIcon}>
          <Hotel color="#FFFFFF" size={25} strokeWidth={2.2} />
        </View>
        <View>
          <Text style={styles.drawerBrandTitle}>Arcadia Hotel</Text>
          <Text style={styles.drawerBrandSub}>Management</Text>
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.drawerNav}>
        {sideNavItems.map(item => {
          const active = item.key === activeScreen;
          const Icon = item.icon;
          return (
            <Pressable
              key={`${item.key}-${item.label}`}
              style={[styles.drawerNavItem, active && styles.activeDrawerNavItem]}
              onPress={() => onNavigate(item.key)}>
              <Icon color="#FFFFFF" size={19} strokeWidth={2} />
              <Text style={styles.drawerNavText}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.drawerHotel}>
        <View style={styles.drawerHotelIcon}>
          <Hotel color="#FFFFFF" size={24} strokeWidth={2} />
        </View>
        <View style={styles.drawerHotelText}>
          <Text style={styles.drawerHotelLabel}>Current Hotel</Text>
          <Text style={styles.drawerHotelName}>{hotelName}</Text>
        </View>
        <ChevronRight color="#FFFFFF" size={16} strokeWidth={2} />
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

export default App;
