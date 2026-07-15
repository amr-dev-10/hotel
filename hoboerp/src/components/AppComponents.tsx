import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import type { ReservationView, TicketView } from '../modules/dashboard';
import { priorityTone, statusTone } from '../modules/operations/utils';
import { buildBottomTabs } from '../navigation/navigationConfig';
import type { IconComponent, ScreenAction, ScreenKey } from '../navigation/types';
import { canOpenScreen, canUseAction } from '../permissions/navigationGuard';
import {colors} from '../theme/colors';
import { blue, muted, styles, textColor } from '../theme/styles';
import {
  CalendarDays,
  ChevronRight,
  Home,
  MoreHorizontal,
  Plus,
  Search,
  User,
  Wrench,
} from './icons';

const bottomTabs = buildBottomTabs({Home, Plus, Search: CalendarDays, User, Wrench});

export type ActionMenuItem = {
  label: string;
  onPress: () => void;
  tone?: 'danger' | 'default';
};

export function TopAppBar({
  title,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  secondaryRightIcon: SecondaryRightIcon,
  tertiaryRightIcon: TertiaryRightIcon,
  notificationIcon: NotificationIcon,
  rightAccessory,
  onLeftPress,
  onRightPress,
  onSecondaryRightPress,
  onTertiaryRightPress,
  onNotificationPress,
}: {
  title: string;
  leftIcon: IconComponent;
  rightIcon?: IconComponent;
  secondaryRightIcon?: IconComponent;
  tertiaryRightIcon?: IconComponent;
  notificationIcon?: IconComponent;
  rightAccessory?: ReactNode;
  onLeftPress?: () => void;
  onRightPress?: () => void;
  onSecondaryRightPress?: () => void;
  onTertiaryRightPress?: () => void;
  onNotificationPress?: () => void;
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
        {NotificationIcon ? (
          <Pressable style={styles.iconButton} onPress={onNotificationPress}>
            <NotificationIcon color={textColor} size={21} strokeWidth={2.2} />
          </Pressable>
        ) : null}
        {SecondaryRightIcon ? (
          <Pressable style={styles.iconButton} onPress={onSecondaryRightPress}>
            <SecondaryRightIcon color={textColor} size={21} strokeWidth={2.2} />
          </Pressable>
        ) : null}
        {TertiaryRightIcon ? (
          <Pressable style={styles.iconButton} onPress={onTertiaryRightPress}>
            <TertiaryRightIcon color={textColor} size={21} strokeWidth={2.2} />
          </Pressable>
        ) : null}
        {rightAccessory}
      </View>
    </View>
  );
}

export function BottomNav({
  activeScreen,
  onCreate,
  onNavigate,
  permissions,
}: {
  activeScreen: ScreenKey;
  onCreate: () => void;
  onNavigate: ScreenAction;
  permissions?: string[];
}) {
  const visibleTabs = bottomTabs.filter(tab =>
    tab.key === 'assistant'
      ? canUseAction(permissions, 'createTicket')
      : canOpenScreen(permissions, tab.key),
  );

  return (
    <View style={styles.bottomNav}>
      {visibleTabs.map(tab => {
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
                color={isFab ? colors.white : active ? blue : textColor}
                size={isFab ? 24 : 21}
                strokeWidth={2.2}
              />
            </View>
            {tab.label ? (
              <Text
                numberOfLines={1}
                style={[styles.bottomNavText, active && styles.activeBottomNavText]}>
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
  onPress,
  title,
  tasks,
  tone,
  up,
}: {
  icon: IconComponent;
  onPress?: () => void;
  title: string;
  tasks: number;
  tone: 'blue' | 'green' | 'orange' | 'red';
  up?: boolean;
}) {
  return (
    <Pressable style={styles.departmentRow} onPress={onPress}>
      <View style={[styles.departmentIcon, styles[`${tone}Tile`]]}>
        <Icon color={toneColor(tone)} size={18} strokeWidth={2.2} />
      </View>
      <Text style={styles.departmentName}>{title}</Text>
      <Text style={styles.departmentTasks}>{tasks} Open Tasks</Text>
      <Text style={[styles.trendIcon, up && styles.dangerText]}>⌃</Text>
    </Pressable>
  );
}

export function ReservationCard({
  actions,
  reservation,
  onPress,
}: {
  actions?: ActionMenuItem[];
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
          {actions ? <ActionMenu items={actions} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

export function TicketCard({
  actions,
  ticket,
  onPress,
}: {
  actions?: ActionMenuItem[];
  ticket: TicketView;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.ticketCard} onPress={onPress}>
      <View style={styles.rowBetween}>
        <Text style={styles.ticketCode}>{ticket.code}</Text>
        <View style={styles.ticketCardActions}>
          <View style={styles.ticketBadgeRow}>
            <StatusBadge label={ticket.priority} tone={priorityTone(ticket.priority)} />
            <StatusBadge label={ticket.status} tone={statusTone(ticket.status)} />
          </View>
          {actions ? <ActionMenu items={actions} /> : null}
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

export function SearchBox({
  placeholder,
  value,
  onChangeText,
}: {
  placeholder: string;
  value?: string;
  onChangeText?: (value: string) => void;
}) {
  return (
    <View style={styles.searchBox}>
      <Search color={muted} size={17} strokeWidth={2} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

export function ActionMenu({
  items,
}: {
  items: ActionMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({height: 0, width: 0, x: 0, y: 0});
  const buttonRef = useRef<View>(null);
  const window = useWindowDimensions();
  const menuWidth = 190;
  const estimatedHeight = Math.min(280, items.length * 40 + 14);
  const panelLeft = Math.max(
    12,
    Math.min(anchor.x + anchor.width - menuWidth, window.width - menuWidth - 12),
  );
  const panelTop = Math.max(
    12,
    Math.min(anchor.y + anchor.height + 6, window.height - estimatedHeight - 12),
  );

  if (!items.length) {
    return null;
  }

  function toggleMenu() {
    if (open) {
      setOpen(false);
      return;
    }

    buttonRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({height, width, x, y});
      setOpen(true);
    });
  }

  return (
    <View style={styles.actionMenuContainer}>
      <Pressable
        ref={buttonRef}
        style={styles.actionMenuButton}
        onPress={toggleMenu}>
        <MoreHorizontal color={textColor} size={18} strokeWidth={2.2} />
      </Pressable>
      <Modal
        animationType="fade"
        transparent
        visible={open}
        onRequestClose={() => setOpen(false)}>
        <View style={styles.actionMenuOverlay}>
          <Pressable
            style={styles.actionMenuBackdrop}
            onPress={() => setOpen(false)}
          />
          <View
            style={[
              styles.actionMenuPanel,
              {
                left: panelLeft,
                maxHeight: Math.max(160, window.height - panelTop - 12),
                top: panelTop,
                width: menuWidth,
              },
            ]}>
          {items.map(item => (
            <Pressable
              key={item.label}
              style={styles.actionMenuItem}
              onPress={() => {
                setOpen(false);
                item.onPress();
              }}>
              <Text
                style={[
                  styles.actionMenuText,
                  item.tone === 'danger' && styles.actionMenuDangerText,
                ]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
          </View>
        </View>
      </Modal>
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

export function LoadingProcessCard({
  active = true,
  floating = false,
  label = 'Loading latest data',
  processes = [],
}: {
  active?: boolean;
  floating?: boolean;
  label?: string;
  processes?: string[];
}) {
  const visibleProcesses = Array.from(
    new Set(processes.map(process => process.trim()).filter(Boolean)),
  );
  const displayProcesses = visibleProcesses.length ? visibleProcesses : [label];

  if (!active && visibleProcesses.length === 0) {
    return null;
  }

  return (
    <View style={[styles.loadingProcessCard, floating ? styles.loadingProcessFloatingCard : null]}>
      <View style={styles.loadingProcessTitleRow}>
        <ActivityIndicator color={blue} size="small" />
        <View style={styles.loadingProcessTextBlock}>
          <Text style={styles.loadingProcessTitle}>
            {displayProcesses.length > 1 ? 'Loading processes' : displayProcesses[0]}
          </Text>
          <Text style={styles.loadingProcessSubtitle}>Please wait while this finishes.</Text>
        </View>
      </View>
      {displayProcesses.length > 1 ? (
        <View style={styles.loadingProcessList}>
          {displayProcesses.map(process => (
            <View key={process} style={styles.loadingProcessPill}>
              <Text style={styles.loadingProcessPillText}>{process}</Text>
            </View>
          ))}
        </View>
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
      <View style={styles.quickActionIcon}>
        <Icon color={textColor} size={18} strokeWidth={2.1} />
      </View>
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
      <ChevronRight color={colors.disabledText} size={18} strokeWidth={2} />
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
    green: colors.success,
    orange: colors.priorityHigh,
    red: colors.danger,
  }[tone];
}
