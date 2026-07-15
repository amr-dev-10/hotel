import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/useAuthStore';
import { COLORS } from '../utils/constants';
import { SessionManager } from '../services/session';

// Manager screens
import { ManagerDashboardScreen } from '../screens/manager/DashboardScreen';
import { ManagerTasksScreen } from '../screens/manager/TasksScreen';
import { TaskHistoryScreen } from '../screens/shared/TaskHistoryScreen';

// Attendant screens
import { AttendantDashboardScreen } from '../screens/attendant/DashboardScreen';
import { AttendantTasksScreen } from '../screens/attendant/TasksScreen';

// Shared screens
import { CreateTaskScreen } from '../screens/shared/CreateTaskScreen';
import { ChatListScreen } from '../screens/shared/ChatListScreen';
import { NotificationsScreen } from '../screens/shared/NotificationsScreen';
import { withScreenLoader } from '../components/common/ScreenLoaderWrapper';
import { startEscalationAlerts, startEscalationChecker } from '../services/escalationService';

const Tab = createBottomTabNavigator();

const ManagerDashboardWithLoader = withScreenLoader(ManagerDashboardScreen);
const ManagerTasksWithLoader = withScreenLoader(ManagerTasksScreen);
const TaskHistoryWithLoader = withScreenLoader(TaskHistoryScreen);
const AttendantDashboardWithLoader = withScreenLoader(AttendantDashboardScreen);
const AttendantTasksWithLoader = withScreenLoader(AttendantTasksScreen);
const CreateTaskWithLoader = withScreenLoader(CreateTaskScreen);
const ChatListWithLoader = withScreenLoader(ChatListScreen);
const NotificationsWithLoader = withScreenLoader(NotificationsScreen);

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, { active: IoniconName; inactive: IoniconName }> = {
    Home: { active: 'home', inactive: 'home-outline' },
    Tasks: { active: 'list', inactive: 'list-outline' },
    AddTask: { active: 'add-circle', inactive: 'add-circle-outline' },
    History: { active: 'time', inactive: 'time-outline' },
    Chat: { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
    Alerts: { active: 'notifications', inactive: 'notifications-outline' },
  };
  const iconName = focused
    ? (icons[name]?.active ?? 'ellipse')
    : (icons[name]?.inactive ?? 'ellipse-outline');
  return (
    <Ionicons
      name={iconName}
      size={24}
      color={focused ? COLORS.PRIMARY : '#94A3B8'}
    />
  );
}

export function MainTabNavigator() {
  const { jobRole } = useAuthStore();
  const normalizeRole = (r?: string | null) => (r ?? '').toString().trim().toLowerCase();
  const isHotelOwner = useAuthStore((s) => s.isHotelOwner);
  const hotelId = useAuthStore((s) => s.hotelId);
  const department = useAuthStore((s) => s.department);
  const normalized = normalizeRole(jobRole);
  const isManager = normalized === 'manager' || normalized === 'frontdesk' || normalized === 'front_desk' || !!isHotelOwner;
  const [initialRouteName, setInitialRouteName] = useState<string | null>(null);
  const [alertBadge, setAlertBadge] = useState(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let mounted = true;
    SessionManager.getActiveTab().then((storedTab) => {
      if (!mounted) return;
      const allowedTabs = isManager
        ? ['Home', 'Tasks', 'AddTask', 'History', 'Chat', 'Alerts']
        : ['Home', 'Tasks', 'Chat'];
      setInitialRouteName(allowedTabs.includes(storedTab ?? '') ? storedTab : 'Home');
    });
    return () => {
      mounted = false;
    };
  }, [isManager]);

  // Managers/owners: keep the SLA-escalation sweep running and surface a
  // local notification + ringtone + a badge on the Alerts tab whenever a new
  // escalation lands (from either this device's sweep or the server-side bot).
  useEffect(() => {
    if (!isManager || !hotelId) return;
    const stopChecker = startEscalationChecker(hotelId);
    const stopAlerts = startEscalationAlerts(
      hotelId,
      { isOwner: !!isHotelOwner, department },
      () => setAlertBadge((n) => n + 1),
    );
    return () => {
      stopChecker();
      stopAlerts();
    };
  }, [isManager, hotelId, isHotelOwner, department]);

  if (!initialRouteName) {
    return (
      <View style={loadingStyles.container}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    );
  }

  const tabBarOptions = {
    tabBarActiveTintColor: COLORS.PRIMARY,
    tabBarInactiveTintColor: '#94A3B8',
    tabBarStyle: {
      backgroundColor: COLORS.WHITE,
      borderTopWidth: 1,
      borderTopColor: COLORS.OUTLINE_VARIANT,
      height: 64 + insets.bottom,
      paddingBottom: insets.bottom + 4,
      paddingTop: 6,
      elevation: 12,
      shadowColor: '#111C2D',
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: -4 },
    },
    tabBarLabelStyle: {
      fontSize: 10,
      fontWeight: '600' as const,
      letterSpacing: 0.3,
    },
    headerStyle: { backgroundColor: COLORS.PRIMARY_DARK },
    headerTintColor: '#fff',
    headerTitleStyle: { fontWeight: '700' as const, letterSpacing: 0.5 },
  };

  if (isManager) {
    return (
      <Tab.Navigator screenOptions={tabBarOptions} initialRouteName={initialRouteName}>
        <Tab.Screen
          name="Home"
          component={ManagerDashboardWithLoader}
          options={{
            title: 'Home',
            headerShown: false,
            tabBarIcon: ({ focused }) => <TabIcon name="Home" focused={focused} />,
          }}
          listeners={{ focus: () => { void SessionManager.setActiveTab('Home'); } }}
        />
        <Tab.Screen
          name="Tasks"
          component={ManagerTasksWithLoader}
          options={{
            title: 'Tasks',
            headerShown: false,
            tabBarIcon: ({ focused }) => <TabIcon name="Tasks" focused={focused} />,
          }}
          listeners={{ focus: () => { void SessionManager.setActiveTab('Tasks'); } }}
        />
        <Tab.Screen
          name="AddTask"
          component={CreateTaskWithLoader}
          options={{
            title: 'Add Task',
            headerShown: false,
            tabBarIcon: ({ focused }) => <TabIcon name="AddTask" focused={focused} />,
          }}
          listeners={{ focus: () => { void SessionManager.setActiveTab('AddTask'); } }}
        />
        <Tab.Screen
          name="History"
          component={TaskHistoryWithLoader}
          options={{
            title: 'History',
            headerShown: false,
            tabBarIcon: ({ focused }) => <TabIcon name="History" focused={focused} />,
          }}
          listeners={{ focus: () => { void SessionManager.setActiveTab('History'); } }}
        />
        <Tab.Screen
          name="Chat"
          component={ChatListWithLoader}
          options={{
            title: 'Chats',
            headerShown: false,
            tabBarIcon: ({ focused }) => <TabIcon name="Chat" focused={focused} />,
          }}
          listeners={{ focus: () => { void SessionManager.setActiveTab('Chat'); } }}
        />
        <Tab.Screen
          name="Alerts"
          component={NotificationsWithLoader}
          options={{
            title: 'Alerts',
            headerShown: false,
            tabBarIcon: ({ focused }) => <TabIcon name="Alerts" focused={focused} />,
            tabBarBadge: alertBadge > 0 ? (alertBadge > 99 ? '99+' : alertBadge) : undefined,
            tabBarBadgeStyle: { backgroundColor: COLORS.ERROR, color: COLORS.WHITE },
          }}
          listeners={{
            focus: () => {
              setAlertBadge(0);
              void SessionManager.setActiveTab('Alerts');
            },
          }}
        />
      </Tab.Navigator>
    );
  }

  return (
    <Tab.Navigator screenOptions={tabBarOptions} initialRouteName={initialRouteName}>
      <Tab.Screen
        name="Home"
        component={AttendantDashboardWithLoader}
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon name="Home" focused={focused} />,
        }}
        listeners={{ focus: () => { void SessionManager.setActiveTab('Home'); } }}
      />
      <Tab.Screen
        name="Tasks"
        component={AttendantTasksWithLoader}
        options={{
          title: 'Tasks',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon name="Tasks" focused={focused} />,
        }}
        listeners={{ focus: () => { void SessionManager.setActiveTab('Tasks'); } }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatListWithLoader}
        options={{
          title: 'Chats',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon name="Chat" focused={focused} />,
        }}
        listeners={{ focus: () => { void SessionManager.setActiveTab('Chat'); } }}
      />
    </Tab.Navigator>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.SURFACE,
  },
});
