import {useEffect, useState} from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View
} from 'react-native';

import {
  DepartmentRow,
  ErrorNotice,
  LoadingProcessCard,
  MetricTile,
  OverviewStat,
  QuickAction,
  SectionTitle,
  TopAppBar
} from '../../../components/AppComponents';

import {
  Bell,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Menu,
  Ticket,
  Utensils,
  Users,
  Wrench
} from '../../../components/icons';

import {blue, styles} from '../../../theme/styles';
import type {ScreenAction} from '../../../navigation/types';
import type {AppData} from '../../dashboard';

import {canOpenScreen, canUseAction} from '../../../permissions/navigationGuard';

export function DashboardScreen({
  data,
  error,
  loading,
  loadingProcesses,
  onMenu,
  onNavigate,
  onOpenNotifications,
  onOpenTicketForm,
  permissions,
  onRefresh,
}: {
  data: AppData;
  error: string | null;
  loading: boolean;
  loadingProcesses: string[];
  onMenu: () => void;
  onNavigate: ScreenAction;
  onOpenNotifications: () => void;
  onOpenTicketForm: () => void;
  permissions?: string[];
  onRefresh: () => void;
}) {
  const [quickActionsExpanded, setQuickActionsExpanded] = useState(true);
  const quickActions = [
    {
      icon: Ticket,
      label: 'Create Ticket',
      onPress: onOpenTicketForm,
      visible: canUseAction(permissions, 'createTicket'),
    },
    {
      icon: CalendarDays,
      label: 'Reservation',
      onPress: () => onNavigate('reservations'),
      visible: canOpenScreen(permissions, 'reservations'),
    },
    {
      icon: Users,
      label: 'Guest',
      onPress: () => onNavigate('guests'),
      visible: canOpenScreen(permissions, 'guests'),
    },
    {
      icon: Utensils,
      label: 'Kitchen',
      onPress: () => onNavigate('kitchen'),
      visible: canOpenScreen(permissions, 'kitchen'),
    },
  ].filter(action => action.visible);
  const departmentRows = [
    {
      icon: ClipboardCheck,
      onPress: () => onNavigate('housekeeping'),
      screen: 'housekeeping' as const,
      tasks: data.housekeeping.length,
      title: 'Housekeeping',
      tone: 'blue' as const,
      up: false,
    },
    {
      icon: Wrench,
      onPress: () => onNavigate('tickets'),
      screen: 'tickets' as const,
      tasks: data.openTickets,
      title: 'Tickets',
      tone: 'red' as const,
      up: data.openTickets > 0,
    },
    {
      icon: Utensils,
      onPress: () => onNavigate('food'),
      screen: 'food' as const,
      tasks: data.orders.length,
      title: 'F&B Service',
      tone: 'orange' as const,
      up: data.orders.length > 0,
    },
    {
      icon: Users,
      onPress: () => onNavigate('staff'),
      screen: 'staff' as const,
      tasks: data.staff.length,
      title: 'Staff',
      tone: 'green' as const,
      up: false,
    },
  ].filter(row => canOpenScreen(permissions, row.screen));

  const runQuickAction = (action: () => void) => {
    action();
  };

  useEffect(() => {
  }, []);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}>
      <TopAppBar
        title="Dashboard"
        leftIcon={Menu}
        onLeftPress={onMenu}
        rightIcon={Bell}
        onRightPress={onOpenNotifications}
      />
      <LoadingProcessCard
        active={loading}
        label="Loading dashboard data"
        processes={loadingProcesses}
      />
      <ErrorNotice message={error} onRetry={onRefresh} />
      <View style={styles.overviewCard}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.overviewTitle}>Today's Overview</Text>
            <Text style={styles.overviewDate}>Live operations from API</Text>
          </View>
        </View>
        <View style={styles.overviewStats}>
          <OverviewStat label="Check-ins" value={String(data.todayCheckIns)} trend="Live" />
          <OverviewStat label="Check-outs" value={String(data.todayCheckOuts)} trend="Live" />
          <OverviewStat label="Occupancy" value={`${data.occupancy}%`} trend="Live" />
          <OverviewStat label="Pending Tickets" value={String(data.openTickets)} trend="Live" danger />
        </View>
      </View>

      <SectionTitle title="Rooms Overview" />
      <View style={styles.roomGrid}>
        <MetricTile label="Total Rooms" value={data.roomsTotal} tone="blue" />
        <MetricTile label="Occupied" value={data.occupiedRooms} tone="green" />
        <MetricTile label="Vacant" value={data.vacantRooms} tone="orange" />
        <MetricTile label="Out of Order" value={data.outOfOrderRooms} tone="red" />
      </View>

      {departmentRows.length ? (
        <>
          <SectionTitle title="Department Status" />
          <View style={styles.cardStack}>
            {departmentRows.map(row => (
              <DepartmentRow
                key={row.title}
                icon={row.icon}
                onPress={row.onPress}
                title={row.title}
                tasks={row.tasks}
                tone={row.tone}
                up={row.up}
              />
            ))}
          </View>
        </>
      ) : null}

      {quickActions.length ? (
        <View style={styles.quickGrid}>
          <Pressable
            style={styles.quickMenuHeader}
            onPress={() => setQuickActionsExpanded(current => !current)}>
            <Text style={styles.quickMenuTitle}>Quick Actions</Text>
            <View style={[styles.collapsibleSectionIcon, quickActionsExpanded && styles.collapsibleSectionIconOpen]}>
              <ChevronRight color={blue} size={18} strokeWidth={2.4} />
            </View>
          </Pressable>
          {quickActionsExpanded ? (
            <View style={[styles.collapsibleSectionBody, styles.quickDrawerList]}>
              {quickActions.map(action => (
                <QuickAction
                  key={action.label}
                  icon={action.icon}
                  label={action.label}
                  onPress={() => runQuickAction(action.onPress)}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
