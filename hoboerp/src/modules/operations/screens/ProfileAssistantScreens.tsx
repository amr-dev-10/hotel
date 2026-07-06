
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from 'react-native';

import {
  Avatar,
  ProfileOption,
  TopAppBar
} from '../../../components/AppComponents';

import {
  Bell,
  ChevronLeft,
  KeyRound,
  LockKeyhole,
  LogOut,
  Menu,
  Mic,
  Send,
  Settings,
  User
} from '../../../components/icons';

import {blue, styles} from '../../../theme/styles';
import type {ScreenAction} from '../../../navigation/types';
import type {AppData} from '../../dashboard';

import type {UserProfile} from '../../../types/domain';

export function AssistantScreen({
  data,
  onBack,
  onMenu,
  onOpenNotifications,
}: {
  data: AppData;
  onBack: () => void;
  onMenu: () => void;
  onOpenNotifications: () => void;
}) {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.chatContent}>
        <TopAppBar
          title="AI Assistant"
          leftIcon={ChevronLeft}
          onLeftPress={onBack}
          rightIcon={Menu}
          notificationIcon={Bell}
          onRightPress={onMenu}
          onNotificationPress={onOpenNotifications}
        />
        <View style={styles.userBubble}>
          <Text style={styles.userBubbleText}>Show me today's occupancy and pending tickets</Text>
          <Text style={styles.bubbleTime}>10:30 AM</Text>
        </View>
        <View style={styles.aiBubble}>
          <Text style={styles.aiBubbleText}>Here is the summary for today:</Text>
          <Text style={styles.aiListText}>• Occupancy: {data.occupancy}%</Text>
          <Text style={styles.aiListText}>• Total Rooms: {data.roomsTotal}</Text>
          <Text style={styles.aiListText}>• Occupied: {data.occupiedRooms}</Text>
          <Text style={styles.aiListText}>• Vacant: {data.vacantRooms}</Text>
          <Text style={styles.aiListText}>• Out of Order: {data.outOfOrderRooms}</Text>
          <Text style={styles.aiListText}>• Pending Tickets: {data.openTickets}</Text>
        </View>
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          placeholder="Ask anything..."
          placeholderTextColor="#94A3B8"
          style={styles.composerInput}
        />
        <Mic color="#64748B" size={18} strokeWidth={2} />
        <View style={styles.sendButton}>
          <Send color={blue} size={18} strokeWidth={2.2} />
        </View>
      </View>
    </View>
  );
}

export function ProfileScreen({
  hotelName,
  user,
  onBack,
  onLogout,
  onMenu,
  onOpenNotifications,
  onNavigate,
  onOpenProfileOption,
}: {
  hotelName: string;
  user: UserProfile;
  onBack: () => void;
  onLogout: () => void;
  onMenu: () => void;
  onOpenNotifications: () => void;
  onNavigate: ScreenAction;
  onOpenProfileOption: (label: string) => void;
}) {
  const options = [
    ['My Profile', User],
    ['Change Password', LockKeyhole],
    ['Notifications', Bell],
    ['App Settings', Settings],
    ['Help & Support', KeyRound],
  ] as const;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <TopAppBar
        title="Profile"
        leftIcon={ChevronLeft}
        onLeftPress={onBack}
        rightIcon={Menu}
        notificationIcon={Bell}
        onRightPress={onMenu}
        onNotificationPress={onOpenNotifications}
      />
      <View style={styles.profileHeader}>
        <Avatar label="A" size={58} />
        <View>
          <Text style={styles.profileName}>{user.name ?? user.email}</Text>
          <Text style={styles.caption}>{user.email}</Text>
          <Text style={styles.profileRole}>{user.job_role ?? user.user_type ?? 'User'}</Text>
          <Text style={styles.profileHotel}>{hotelName}</Text>
        </View>
      </View>
      <View style={styles.profileOptions}>
        {options.map(([label, Icon]) => (
          <ProfileOption
            key={label}
            icon={Icon}
            label={label}
            onPress={() =>
              label === 'Notifications'
                ? onNavigate('notifications')
                : onOpenProfileOption(label)
            }
          />
        ))}
        <Pressable style={styles.profileOption} onPress={onLogout}>
          <LogOut color="#DC2626" size={19} strokeWidth={2} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
