import {Pressable, ScrollView, Text, TextInput, View} from 'react-native';

import {Bell, ChevronRight, Home, Phone, Plus, Search, User} from './icons';
import {buildBottomTabs} from './navigationConfig';
import {blue, muted, styles, textColor} from './styles';
import type {IconComponent, ScreenAction, ScreenKey} from './types';
import type {ReservationView, TicketView} from '../modules/dashboard';
import {priorityTone, statusTone} from '../modules/operations/utils';

const bottomTabs = buildBottomTabs({Bell, Home, Plus, Search, User});

export function TopAppBar({
  title,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  secondaryRightIcon: SecondaryRightIcon,
  onLeftPress,
  onRightPress,
  onSecondaryRightPress,
}: {
  title: string;
  leftIcon: IconComponent;
  rightIcon?: IconComponent;
  secondaryRightIcon?: IconComponent;
  onLeftPress?: () => void;
  onRightPress?: () => void;
  onSecondaryRightPress?: () => void;
}) {
  return (
    <View style={styles.topAppBar}>
      <Pressable style={styles.iconButton} onPress={onLeftPress}>
        <LeftIcon color={textColor} size={22} strokeWidth={2.2} />
      </Pressable>
      <Text style={styles.topTitle}>{title}</Text>
      <View style={styles.topActions}>
        {RightIcon ? (
          <Pressable style={styles.iconButton} onPress={onRightPress}>
            <RightIcon color={textColor} size={21} strokeWidth={2.2} />
          </Pressable>
        ) : null}
        {SecondaryRightIcon ? (
          <Pressable style={styles.iconButton} onPress={onSecondaryRightPress}>
            <SecondaryRightIcon color={textColor} size={21} strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function BottomNav({
  activeScreen,
  onCreate,
  onNavigate,
}: {
  activeScreen: ScreenKey;
  onCreate: () => void;
  onNavigate: ScreenAction;
}) {
  return (
    <View style={styles.bottomNav}>
      {bottomTabs.map(tab => {
        const active = tab.key === activeScreen;
        const Icon = tab.icon;
        const isFab = tab.key === 'assistant';
        return (
          <Pressable
            key={tab.key}
            style={styles.bottomNavItem}
            onPress={() => (isFab ? onCreate() : onNavigate(tab.key))}>
            <View style={[isFab && styles.fabButton]}>
              <Icon
                color={isFab ? '#FFFFFF' : active ? blue : textColor}
                size={isFab ? 24 : 21}
                strokeWidth={2.2}
              />
            </View>
            {tab.label ? (
              <Text style={[styles.bottomNavText, active && styles.activeBottomNavText]}>
                {tab.label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function OverviewStat({
  label,
  value,
  trend,
  danger,
}: {
  label: string;
  value: string;
  trend: string;
  danger?: boolean;
}) {
  return (
    <View style={styles.overviewStat}>
      <Text style={styles.overviewValue}>{value}</Text>
      <Text style={styles.overviewLabel}>{label}</Text>
      <Text style={[styles.overviewTrend, danger && styles.dangerText]}>
        {danger ? '▲' : '▲'} {trend}
      </Text>
    </View>
  );
}

export function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'blue' | 'green' | 'orange' | 'red';
}) {
  return (
    <View style={[styles.metricTile, styles[`${tone}Tile`]]}>
      <Text style={[styles.metricValue, styles[`${tone}Text`]]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function DepartmentRow({
  icon: Icon,
  title,
  tasks,
  tone,
  up,
}: {
  icon: IconComponent;
  title: string;
  tasks: number;
  tone: 'blue' | 'green' | 'orange' | 'red';
  up?: boolean;
}) {
  return (
    <View style={styles.departmentRow}>
      <View style={[styles.departmentIcon, styles[`${tone}Tile`]]}>
        <Icon color={toneColor(tone)} size={18} strokeWidth={2.2} />
      </View>
      <Text style={styles.departmentName}>{title}</Text>
      <Text style={styles.departmentTasks}>{tasks} Open Tasks</Text>
      <Text style={[styles.trendIcon, up && styles.dangerText]}>⌃</Text>
    </View>
  );
}

export function ReservationCard({
  reservation,
  onPress,
}: {
  reservation: ReservationView;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.reservationCard} onPress={onPress}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.captionUpper}>Guest</Text>
          <Text style={styles.cardTitle}>{reservation.guestName}</Text>
          <Text style={styles.cardSubtitle}>{reservation.stayDates}</Text>
          <Text style={styles.caption}>{reservation.adults} Adults • {reservation.children} Room</Text>
        </View>
        <View style={styles.reservationRoom}>
          <Text style={styles.captionUpper}>Room</Text>
          <Text style={styles.roomNumberText}>{reservation.roomNumber}</Text>
        </View>
        <View style={styles.reservationSide}>
          <StatusBadge label={reservation.status} tone={statusTone(reservation.status)} />
          <Pressable style={styles.callButton}>
            <Phone color={blue} size={17} strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

export function TicketCard({ticket, onPress}: {ticket: TicketView; onPress: () => void}) {
  return (
    <Pressable style={styles.ticketCard} onPress={onPress}>
      <View style={styles.rowBetween}>
        <Text style={styles.ticketCode}>{ticket.code}</Text>
        <View style={styles.ticketBadgeRow}>
          <StatusBadge label={ticket.priority} tone={priorityTone(ticket.priority)} />
          <StatusBadge label={ticket.status} tone={statusTone(ticket.status)} />
        </View>
      </View>
      <Text style={styles.ticketTitle}>{ticket.title}</Text>
      <Text style={styles.cardSubtitle}>Room {ticket.roomNumber} • {ticket.guestName}</Text>
      <Text style={styles.caption}>{ticket.department} • {ticket.createdAt}</Text>
    </Pressable>
  );
}

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: 'green' | 'blue' | 'orange' | 'red' | 'gray';
}) {
  return (
    <View style={[styles.statusBadge, styles[`${tone}Badge`]]}>
      <Text style={[styles.statusBadgeText, styles[`${tone}Text`]]}>{label}</Text>
    </View>
  );
}

export function SearchBox({placeholder}: {placeholder: string}) {
  return (
    <View style={styles.searchBox}>
      <Search color={muted} size={17} strokeWidth={2} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#64748B"
        style={styles.searchInput}
      />
    </View>
  );
}

export function ChipRow({
  activeLabel,
  labels,
  onSelect,
}: {
  activeLabel?: string;
  labels: string[];
  onSelect?: (label: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}>
      {labels.map((label, index) => {
        const active = activeLabel ? activeLabel === label : index === 0;
        return (
        <Pressable
          key={label}
          style={[styles.chip, active && styles.activeChip]}
          onPress={() => onSelect?.(label)}>
          <Text style={[styles.chipText, active && styles.activeChipText]}>
            {label}
          </Text>
        </Pressable>
      );})}
    </ScrollView>
  );
}

export function EmptyState({label}: {label: string}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>{label}</Text>
    </View>
  );
}

export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry?: () => void;
}) {
  if (!message) {
    return null;
  }

  return (
    <View style={styles.errorNotice}>
      <View style={styles.errorNoticeTextBlock}>
        <Text style={styles.errorNoticeTitle}>Unable to load latest data</Text>
        <Text style={styles.errorNoticeMessage}>{message}</Text>
      </View>
      {onRetry ? (
        <Pressable style={styles.errorRetryButton} onPress={onRetry}>
          <Text style={styles.errorRetryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SectionTitle({
  title,
  action,
  badge,
}: {
  title: string;
  action?: string;
  badge?: string;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : null}
      {badge ? (
        <View style={styles.smallBadge}>
          <Text style={styles.smallBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function QuickAction({
  icon: Icon,
  label,
  onPress,
}: {
  icon: IconComponent;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.quickAction} onPress={onPress}>
      <Icon color={blue} size={20} strokeWidth={2.2} />
      <Text style={styles.quickActionText}>{label}</Text>
    </Pressable>
  );
}

export function RoomAction({
  icon: Icon,
  label,
  onPress,
}: {
  icon: IconComponent;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.roomAction} onPress={onPress}>
      <Icon color={textColor} size={21} strokeWidth={2.1} />
      <Text style={styles.roomActionText}>{label}</Text>
    </Pressable>
  );
}

export function InfoLine({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function ProfileOption({
  icon: Icon,
  label,
  onPress,
}: {
  icon: IconComponent;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.profileOption} onPress={onPress}>
      <Icon color={textColor} size={19} strokeWidth={2} />
      <Text style={styles.profileOptionText}>{label}</Text>
      <ChevronRight color="#94A3B8" size={18} strokeWidth={2} />
    </Pressable>
  );
}

export function Avatar({label, size}: {label: string; size: number}) {
  return (
    <View
      style={[
        styles.avatar,
        {height: size, width: size, borderRadius: size / 2},
      ]}>
      <Text style={styles.avatarText}>{label}</Text>
      <View style={styles.onlineDot} />
    </View>
  );
}

function toneColor(tone: 'blue' | 'green' | 'orange' | 'red') {
  return {
    blue,
    green: '#16A34A',
    orange: '#F97316',
    red: '#DC2626',
  }[tone];
}

