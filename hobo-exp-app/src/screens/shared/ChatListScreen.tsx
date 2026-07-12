import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, doc, query, where } from 'firebase/firestore';
import { onValue, ref as dbRef } from 'firebase/database';
import { db, rtdb } from '../../services/firebaseConfig';
import { RootStackParamList, JobRole } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { TenantManager } from '../../services/tenant';
import { UserAvatar } from '../../components/common/UserAvatar';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type ChatTab = 'Managers' | 'Attendants' | 'Guests';

type ChatListItem = {
  id: string;
  name: string;
  subtitle: string;
  role: JobRole;
  profileImage?: string;
  showSendSms?: boolean;
  online?: boolean;
};

const PRIMARY     = '#003D9B';
const PRIMARY_CT  = '#0052CC';
const WHITE       = '#FFFFFF';
const BG          = '#F9F9FF';
const SURFACE_LO  = '#F0F3FF';
const SURFACE_CT  = '#E7EEFF';
const TEXT_DARK   = '#101C2D';
const TEXT_MID    = '#434654';
const TEXT_SOFT   = '#737685';
const OUTLINE_VAR = '#C3C6D6';
const SLATE_LITE  = '#F1F5F9';
const ERROR       = '#BA1A1A';
const GREEN_DOT   = '#22C55E';

const TAB_ROLE_MATCHERS: Record<ChatTab, string[]> = {
  Managers: ['manager'],
  Attendants: ['attendent', 'attendant'],
  Guests: ['guest'],
};

const TAB_LABELS: Record<ChatTab, string> = {
  Managers: 'Manager',
  Attendants: 'Attendant',
  Guests: 'Guest',
};

function normalize(value: unknown) {
  return (value ?? '').toString().trim().toLowerCase();
}

export function ChatListScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { employeeId, jobRole } = useAuthStore();
  // Attendants are only allowed to message managers and other attendants —
  // the Guest chat panel is hidden from them entirely.
  const normalizedRole = (jobRole ?? '').toString().toLowerCase().replace(/[\s_-]+/g, '');
  const isManager = normalizedRole === 'manager' || normalizedRole === 'frontdesk';
  const availableTabs = (isManager
    ? (['Managers', 'Attendants', 'Guests'] as ChatTab[])
    : (['Managers', 'Attendants'] as ChatTab[]));
  const [activeTab, setActiveTab] = useState<ChatTab>('Managers');
  // If an attendant is somehow on the Guest tab (cached state, role flip),
  // bounce them back to Managers — they aren't allowed to see guest threads.
  useEffect(() => {
    if (!isManager && activeTab === 'Guests') setActiveTab('Managers');
  }, [isManager, activeTab]);
  const [contacts, setContacts] = useState<ChatListItem[]>([]);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [recencyOrder, setRecencyOrder] = useState<string[]>([]);
  const lastUnreadRef = useRef<Record<string, number>>({});
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (activeTab === 'Guests') {
      const guestRef = dbRef(rtdb, TenantManager.rtdbPath('Tickets/AllChatsTest/Guest'));
      const unsubGuest = onValue(guestRef, (snap) => {
        const val = snap.val() ?? {};
        const keys = Object.keys(val);
        const list = keys.map((key) => ({
          id: key,
          name: key,
          subtitle: 'Last Message',
          role: 'Manager' as JobRole,
          showSendSms: true,
        }));
        setContacts(list);
      });

      return () => unsubGuest();
    }

    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const hotelId = TenantManager.getHotelId();
      const usersQ = TenantManager.isValidHotelId(hotelId)
        ? query(collection(db, 'users'), where('hotel_id', '==', hotelId))
        : query(collection(db, 'users'), where('hotel_id', '==', '__NO_HOTEL__'));

      return onSnapshot(usersQ, (snap) => {
      const allowedRoles = TAB_ROLE_MATCHERS[activeTab];
      const people = snap.docs
        .map((d) => {
          const raw = d.data() as Record<string, unknown>;
          const role = (raw.Jobrole ?? raw.JobRole ?? raw.jobrole ?? raw.jobRole ?? 'Attendent') as JobRole;
          const dept = (raw.Department ?? raw.department ?? '').toString();
          const subtitle = dept ? `${role === 'Attendent' ? 'Attendant' : role} · ${dept.replace(/_/g, ' ')}` : (role === 'Attendent' ? 'Attendant' : role);
          const status = raw.Status ?? raw.status;
          const online = typeof status === 'boolean' ? status : normalize(status) === 'true';
          return {
            id: d.id,
            name: (raw.Name ?? raw.name ?? '').toString(),
            subtitle,
            role,
            profileImage: (raw.ProfileImage ?? raw.profileImage ?? '').toString(),
            online,
          } as ChatListItem;
        })
        .filter((p) => p.id !== employeeId)
        .filter((p) => {
          const role = normalize(p.role);
          return allowedRoles.includes(role);
        });
      setContacts(people);
      });
    }) as unknown as () => void;
    return unsub;
  }, [activeTab, employeeId]);

  // Load unread messages for current user; also track recency so the
  // contact whose count just grew bubbles to the top.
  useEffect(() => {
    if (!employeeId) return;
    const unsub = onSnapshot(doc(db, 'users', employeeId), (snap) => {
      const data = snap.data();
      const unseenMessages: any[] = data?.UnseenMessages ?? [];
      const map: Record<string, number> = {};
      unseenMessages.forEach((m: any) => { map[m.UserId] = m.Count; });

      // Detect which UserIds had a count increase since the last snapshot —
      // those are the freshest senders and should jump to the top.
      const prev = lastUnreadRef.current;
      const bumped: string[] = [];
      for (const id of Object.keys(map)) {
        if ((map[id] ?? 0) > (prev[id] ?? 0)) bumped.push(id);
      }
      lastUnreadRef.current = map;

      if (bumped.length > 0) {
        setRecencyOrder((curr) => {
          const next = [...bumped, ...curr.filter((id) => !bumped.includes(id))];
          return next;
        });
      } else {
        // Drop ids that have been read (count cleared) so they don't pin to top.
        setRecencyOrder((curr) => curr.filter((id) => (map[id] ?? 0) > 0));
      }

      setUnreadMap(map);
    });
    return unsub;
  }, [employeeId]);

  const filteredContacts = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const base = q
      ? contacts.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.subtitle.toLowerCase().includes(q),
        )
      : contacts.slice();

    // Sort: recent senders first (by recency order), then anyone with unread
    // (by count, desc), then everyone else in their original order.
    const recencyRank = new Map<string, number>();
    recencyOrder.forEach((id, i) => recencyRank.set(id, i));

    base.sort((a, b) => {
      const ra = recencyRank.has(a.id) ? recencyRank.get(a.id)! : Infinity;
      const rb = recencyRank.has(b.id) ? recencyRank.get(b.id)! : Infinity;
      if (ra !== rb) return ra - rb;
      const ua = unreadMap[a.id] ?? 0;
      const ub = unreadMap[b.id] ?? 0;
      if (ua !== ub) return ub - ua;
      return 0;
    });
    return base;
  }, [contacts, searchText, recencyOrder, unreadMap]);

  const onlineStaff = useMemo(
    () => contacts.filter((c) => c.online).slice(0, 12),
    [contacts]
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Chats" topInset={insets.top} />
      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Hero */}
            <Text style={styles.pageTitle}>Messages</Text>
            <Text style={styles.pageSub}>Coordinate with staff and manage your requests.</Text>

            {/* Search */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={20} color={TEXT_SOFT} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search conversations..."
                placeholderTextColor={TEXT_SOFT}
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>

            {/* Tabs */}
            <View style={styles.tabRow}>
              {availableTabs.map((tab) => {
                const active = activeTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    style={styles.tab}
                    onPress={() => setActiveTab(tab)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>
                      {TAB_LABELS[tab]}
                    </Text>
                    {active && <View style={styles.tabUnderline} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Online staff strip */}
            {onlineStaff.length > 0 ? (
              <View style={styles.onlineSection}>
                <Text style={styles.onlineLabel}>ONLINE STAFF</Text>
                <FlatList
                  data={onlineStaff}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.onlineList}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.onlineItem}
                      activeOpacity={0.85}
                      onPress={() =>
                        navigation.navigate('ChatRoom', {
                          userId: item.id,
                          userName: item.name,
                          userRole: item.role,
                          chatType: 'USER',
                        })
                      }
                    >
                      <View style={styles.onlineAvatarRing}>
                        <View style={styles.onlineAvatarInner}>
                          <UserAvatar profileImage={item.profileImage} name={item.name} size={56} />
                        </View>
                        <View style={styles.onlineDot} />
                      </View>
                      <Text style={styles.onlineName} numberOfLines={1}>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <ContactCard
            contact={item}
            unreadCount={unreadMap[item.id] ?? 0}
            onPress={() => {
              navigation.navigate('ChatRoom', {
                userId: item.id,
                userName: item.name,
                userRole: item.role,
                chatType: item.showSendSms ? 'GUEST' : 'USER',
              });
            }}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={40} color={OUTLINE_VAR} />
            <Text style={styles.emptyText}>No chats found</Text>
          </View>
        }
      />
    </View>
  );
}

function ContactCard({
  contact,
  unreadCount,
  onPress,
}: {
  contact: ChatListItem;
  unreadCount: number;
  onPress: () => void;
}) {
  const hasUnread = unreadCount > 0;

  return (
    <TouchableOpacity
      style={[styles.card, hasUnread && styles.cardUnread]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {hasUnread ? <View style={styles.cardAccent} /> : null}

      <View style={styles.cardAvatar}>
        <UserAvatar profileImage={contact.profileImage} name={contact.name} size={56} />
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={[styles.cardName, hasUnread && styles.cardNameUnread]} numberOfLines={1}>
            {contact.name}
          </Text>
          <Text style={[styles.cardTime, hasUnread && styles.cardTimeUnread]}>
            {contact.showSendSms ? 'Tap' : ''}
          </Text>
        </View>

        <View style={styles.cardBottomRow}>
          <Text
            style={[styles.cardPreview, hasUnread && styles.cardPreviewUnread]}
            numberOfLines={1}
          >
            {contact.subtitle}
          </Text>

          {contact.showSendSms ? (
            <View style={styles.smsBadge}>
              <Ionicons name="chatbox-ellipses-outline" size={12} color={WHITE} />
            </View>
          ) : hasUnread ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: BG },
  listContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },

  // Heading
  pageTitle: { fontSize: 28, fontWeight: '700', color: TEXT_DARK, letterSpacing: -0.5 },
  pageSub:   { fontSize: 14, color: TEXT_MID, marginTop: 6, lineHeight: 20, marginBottom: 18 },

  // Search
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: OUTLINE_VAR,
    paddingHorizontal: 14,
    paddingVertical: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    marginBottom: 18,
  },
  searchIcon:  { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: TEXT_DARK, paddingVertical: 12 },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(195,198,214,0.3)',
    marginBottom: 20,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    position: 'relative',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_MID,
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: PRIMARY_CT,
    fontWeight: '700',
  },
  tabUnderline: {
    position: 'absolute',
    left: 0, right: 0, bottom: -1,
    height: 2,
    backgroundColor: PRIMARY_CT,
    borderRadius: 2,
  },

  // Online staff
  onlineSection: { marginBottom: 16 },
  onlineLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_SOFT,
    letterSpacing: 1.4,
    marginBottom: 14,
  },
  onlineList: { gap: 16, paddingRight: 12 },
  onlineItem: { alignItems: 'center', width: 64 },
  onlineAvatarRing: {
    width: 64, height: 64,
    borderRadius: 32,
    padding: 2,
    backgroundColor: PRIMARY_CT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  onlineAvatarInner: {
    width: 60, height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineDot: {
    position: 'absolute',
    width: 14, height: 14,
    borderRadius: 7,
    backgroundColor: GREEN_DOT,
    borderWidth: 2,
    borderColor: BG,
    bottom: 2, right: 2,
  },
  onlineName: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_DARK,
    textAlign: 'center',
    width: 64,
  },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SLATE_LITE,
    padding: 14,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    overflow: 'hidden',
  },
  cardUnread: {
    elevation: 3,
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  cardAccent: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 4,
    backgroundColor: PRIMARY_CT,
  },
  cardAvatar: { borderRadius: 28, overflow: 'hidden' },
  cardBody:   { flex: 1, gap: 4 },

  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_DARK,
    flex: 1,
  },
  cardNameUnread: { color: TEXT_DARK },
  cardTime: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_SOFT,
  },
  cardTimeUnread: { color: PRIMARY_CT, fontWeight: '600' },

  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardPreview: {
    flex: 1,
    fontSize: 13,
    color: TEXT_MID,
  },
  cardPreviewUnread: { color: TEXT_DARK, fontWeight: '600' },

  unreadBadge: {
    minWidth: 22, height: 22,
    borderRadius: 11,
    backgroundColor: PRIMARY_CT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { color: WHITE, fontSize: 11, fontWeight: '700' },

  smsBadge: {
    width: 22, height: 22,
    borderRadius: 11,
    backgroundColor: PRIMARY_CT,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty
  empty:     { alignItems: 'center', paddingTop: 40, gap: 10 },
  emptyText: { color: TEXT_SOFT, fontSize: 14, fontWeight: '500' },
});
