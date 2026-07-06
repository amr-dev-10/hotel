import {useMemo, useState} from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View
} from 'react-native';

import {
  ActionMenu,
  Avatar,
  ChipRow,
  EmptyState,
  ErrorNotice,
  LoadingProcessCard,
  ReservationCard,
  SearchBox,
  StatusBadge,
  TopAppBar
} from '../../../components/AppComponents';

import {
  Bell,
  ChevronLeft,
  Menu,
  Plus
} from '../../../components/icons';
import {
  filterByStatus,
  filterRecordsByStatus,
  firstRecordValue,
  filterRecordsBySearch,
  isRecordTruthy
} from '../../../utils/dataUtils';
import {styles} from '../../../theme/styles';

import type {ReservationView} from '../../dashboard';
import type {ActionHandler} from '../types';
import {statusTone} from '../utils';

import type {ArcadiaRecord} from '../../../types/domain';
import {ListFooter, useScrollPagination} from './operationScreenHelpers';

export function ReservationsScreen({
  error,
  reservations,
  loading,
  loadingProcesses,
  onBack,
  onMenu,
  onOpenNotifications,
  onOpenReservation,
  onOpenReservationForm,
  onQuickRecordAction,
  onRefresh,
}: {
  error: string | null;
  reservations: ReservationView[];
  loading: boolean;
  loadingProcesses: string[];
  onBack: () => void;
  onMenu: () => void;
  onOpenNotifications: () => void;
  onOpenReservation: (reservation: ReservationView) => void;
  onOpenReservationForm: () => void;
  onQuickRecordAction: ActionHandler;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const filteredReservations = useMemo(
    () => filterRecordsBySearch(filterByStatus(reservations, filter), query),
    [filter, query, reservations],
  );
  const {hasMore, loadMore, visibleItems} = useScrollPagination(filteredReservations);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      data={visibleItems}
      keyExtractor={(item, index) => `${item.bookingId}-${index}`}
      onEndReached={loadMore}
      onEndReachedThreshold={0.35}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      ListFooterComponent={<ListFooter hasMore={hasMore} loading={loading} />}
      ListHeaderComponent={
        <View>
          <TopAppBar
            title="Reservations"
            leftIcon={ChevronLeft}
            onLeftPress={onBack}
            rightIcon={Menu}
            notificationIcon={Bell}
            secondaryRightIcon={Plus}
            onRightPress={onMenu}
            onNotificationPress={onOpenNotifications}
            onSecondaryRightPress={onOpenReservationForm}
          />
          <LoadingProcessCard
            active={loading}
            label="Loading reservations"
            processes={loadingProcesses}
          />
          <ErrorNotice message={error} onRetry={onRefresh} />
          <SearchBox
            placeholder="Search by guest, room, booking ID..."
            value={query}
            onChangeText={setQuery}
          />
          <ChipRow
            labels={['All', 'Today', 'Upcoming', 'Checked In', 'Checked Out']}
            activeLabel={filter}
            onSelect={setFilter}
          />
        </View>
      }
      ListEmptyComponent={
        loading ? null : <EmptyState label="No reservations returned from API." />
      }
      renderItem={({item}) => (
        <ReservationCard
          reservation={item}
          onPress={() => onOpenReservation(item)}
          actions={[
            {label: 'Open Detail', onPress: () => onOpenReservation(item)},
            {label: 'Check In', onPress: () => onQuickRecordAction('reservations', {...item.raw, id: item.id}, 'check-in')},
            {label: 'Check Out', onPress: () => onQuickRecordAction('reservations', {...item.raw, id: item.id}, 'check-out')},
            {label: 'Cancel Reservation', tone: 'danger', onPress: () => onQuickRecordAction('reservations', {...item.raw, id: item.id}, 'cancel')},
          ]}
        />
      )}
    />
  );
}

export function GuestsScreen({
  error,
  guests,
  loading,
  loadingProcesses,
  onBack,
  onMenu,
  onOpenGuest,
  onOpenNotifications,
  onQuickRecordAction,
  onRefresh,
}: {
  error: string | null;
  guests: ArcadiaRecord[];
  loading: boolean;
  loadingProcesses: string[];
  onBack: () => void;
  onMenu: () => void;
  onOpenGuest: (guest: ArcadiaRecord) => void;
  onOpenNotifications: () => void;
  onQuickRecordAction: ActionHandler;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const filteredGuests = useMemo(
    () => filterRecordsBySearch(filterRecordsByStatus(guests, filter), query),
    [filter, guests, query],
  );
  const {hasMore, loadMore, visibleItems} = useScrollPagination(filteredGuests);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      data={visibleItems}
      keyExtractor={(item, index) =>
        `${firstRecordValue(item, ['id', 'phone', 'whatsapp_phone', 'name'])}-${index}`
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.35}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      ListFooterComponent={<ListFooter hasMore={hasMore} loading={loading} />}
      ListHeaderComponent={
        <View>
          <TopAppBar
            title="Guests"
            leftIcon={ChevronLeft}
            onLeftPress={onBack}
            rightIcon={Menu}
            notificationIcon={Bell}
            onRightPress={onMenu}
            onNotificationPress={onOpenNotifications}
          />
          <LoadingProcessCard
            active={loading}
            label="Loading guests"
            processes={loadingProcesses}
          />
          <ErrorNotice message={error} onRetry={onRefresh} />
          <SearchBox
            placeholder="Search guest, phone, email..."
            value={query}
            onChangeText={setQuery}
          />
          <ChipRow
            labels={['All', 'Pre Arrival', 'Checked In', 'Checked Out']}
            activeLabel={filter}
            onSelect={setFilter}
          />
        </View>
      }
      ListEmptyComponent={loading ? null : <EmptyState label="No guests returned from API." />}
      renderItem={({item}) => {
        const name = firstRecordValue(item, ['name', 'guest_name', 'email']);
        const status = firstRecordValue(item, ['status']) || 'Guest';
        const phone = firstRecordValue(item, ['whatsapp_phone', 'phone', 'email']);
        const hasChat = isRecordTruthy(item, ['has_whatsapp_conversation']);
        return (
          <Pressable style={styles.staffCard} onPress={() => onOpenGuest(item)}>
            <Avatar label={(name || 'G').charAt(0)} size={42} />
            <View style={styles.staffText}>
              <Text style={styles.cardTitle}>{name || 'Unknown guest'}</Text>
              <Text style={styles.caption}>{phone || 'No contact saved'}</Text>
              <Text style={styles.captionTiny}>
                Reservations {firstRecordValue(item, ['reservation_count']) || '0'}
              </Text>
            </View>
            <View style={styles.chatMeta}>
              <StatusBadge label={status} tone={statusTone(status)} />
              {hasChat ? <Text style={styles.captionTiny}>WhatsApp linked</Text> : null}
              <ActionMenu
                items={[
                  {label: 'Open Guest', onPress: () => onOpenGuest(item)},
                  {label: 'Create Ticket', onPress: () => onQuickRecordAction('guests', item, 'create-ticket')},
                  {label: 'Delete Guest', tone: 'danger', onPress: () => onQuickRecordAction('guests', item, 'delete')},
                ]}
              />
            </View>
          </Pressable>
        );
      }}
    />
  );
}
