import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
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
import {Avatar, BottomNav} from './AppComponents';
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
import type {ArcadiaRecord, Session, UserProfile} from '../types/domain';

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
  const [popup, setPopup] = useState<PopupKey>(null);
  const [selectedReservation, setSelectedReservation] =
    useState<ReservationView | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<TicketView | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<ArcadiaRecord | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<ArcadiaRecord | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<ArcadiaRecord | null>(null);
  const [selectedConversation, setSelectedConversation] =
    useState<ArcadiaRecord | null>(null);
  const [selectedLabel, setSelectedLabel] = useState('');

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
    useOperationsWorkspace(request, session);

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
          await loadAllResources(nextSession.accessToken, nextSession.user.hotel_id);
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
  }, [loadAllResources]);

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
      await loadAllResources(token, profile.data.hotel_id);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setAuthLoading(false);
    }
  }, [email, loadAllResources, password]);

  const handleLogout = useCallback(() => {
    setSession(null);
    AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    resetWorkspace();
    setScreen('dashboard');
    setDrawerOpen(false);
  }, [resetWorkspace]);

  const openScreen = useCallback<ScreenAction>(nextScreen => {
    setScreen(nextScreen);
    setDrawerOpen(false);
  }, []);

  const closePopup = useCallback(() => {
    setPopup(null);
    setSelectedLabel('');
  }, []);

  const openTicketForm = useCallback(() => {
    setSelectedTicket(null);
    setSelectedReservation(null);
    setSelectedConversation(null);
    setSelectedGuest(null);
    setPopup('ticketForm');
  }, []);

  const openContextTicketForm = useCallback(() => {
    setSelectedTicket(null);
    setPopup('ticketForm');
  }, []);

  const openReservationForm = useCallback(() => {
    setSelectedReservation(null);
    setPopup('reservationForm');
  }, []);

  const openTicketDetail = useCallback((ticket: TicketView) => {
    setSelectedTicket(ticket);
    setPopup('ticketDetail');
  }, []);

  const openReservationDetail = useCallback((reservation: ReservationView) => {
    setSelectedReservation(reservation);
    setSelectedGuest(null);
    setSelectedConversation(null);
    setPopup('reservationDetail');
  }, []);

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
    setPopup('guestDetail');
  }, []);

  const openStaffProfile = useCallback((staff: ArcadiaRecord) => {
    setSelectedStaff(staff);
    setPopup('staffProfile');
  }, []);

  const openWhatsAppChat = useCallback((conversation: ArcadiaRecord) => {
    setSelectedConversation(conversation);
    setSelectedGuest(null);
    setSelectedReservation(null);
    setSelectedLabel('');
    setPopup('whatsappChat');
  }, []);

  const refreshResource = useCallback(
    (resource: ResourceKey) => {
      loadResource(resource);
    },
    [loadResource],
  );

  const refreshActiveData = useCallback(() => {
    if (screen === 'reservations') {
      loadResource('reservations');
    }
    if (screen === 'tickets') {
      loadResource('tickets');
    }
    if (screen === 'escalations') {
      loadResource('escalations');
    }
    if (screen === 'notifications') {
      loadResource('notifications');
    }
    if (screen === 'guests') {
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
    if (screen === 'whatsapp') {
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
            user={session.user}
            onNavigate={openScreen}
          />
        ) : null}
        <View style={styles.phoneSurface}>
          <ErrorBoundary key={screen}>
            <ScreenContent
              data={appData}
              error={activeError}
              loading={isScreenLoading(screen, resources)}
              screen={screen}
              user={session.user}
              onBack={() => openScreen('dashboard')}
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
              onOpenTicketForm={openTicketForm}
              onOpenWhatsAppChat={openWhatsAppChat}
              onRefresh={refreshActiveData}
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
                  user={session.user}
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
        />
      </View>
    </SafeAreaView>
  );
}

function SideDrawer({
  activeScreen,
  user,
  onNavigate,
}: {
  activeScreen: ScreenKey;
  user: UserProfile;
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
      <View style={styles.drawerUser}>
        <Avatar label="A" size={46} />
        <View>
          <Text style={styles.drawerUserName}>{user.name ?? user.email}</Text>
          <Text style={styles.drawerUserRole}>{user.job_role ?? user.user_type ?? 'User'}</Text>
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
          <Text style={styles.drawerHotelName}>{user.hotel_id}</Text>
        </View>
        <ChevronRight color="#FFFFFF" size={16} strokeWidth={2} />
      </View>
    </View>
  );
}

export default App;
