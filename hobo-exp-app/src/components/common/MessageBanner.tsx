import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UsersService } from '../../services/backend';
import { useAuthStore } from '../../store/useAuthStore';
import { UserAvatar } from './UserAvatar';
import { navigate, getCurrentRouteName, getCurrentRouteParams } from '../../navigation/navigationRef';
import type { JobRole, User } from '../../types';

// Detects increases in the current user's UnseenMessages array and
// shows a top-bar banner with the sender's name + role/department. Tap → opens
// ChatRoom for that contact. Suppressed while the user is already viewing the
// matching ChatRoom.

type UnseenEntry = { UserId: string; Name: string; Count: number };

type BannerInfo = {
  userId: string;
  name: string;
  subtitle: string;
  role: JobRole;
  profileImage?: string;
};

const AUTO_DISMISS_MS = 6000;

function formatSubtitle(user: User | null, fallbackName: string): { subtitle: string; role: JobRole } {
  if (!user) return { subtitle: '', role: 'Attendent' };
  const role: JobRole = (user.Jobrole as JobRole) || 'Attendent';
  const roleLabel = role === 'Attendent' ? 'Attendant' : role;
  const dept = (user.Department || '').toString();
  const subtitle = dept ? `${roleLabel} · ${dept.replace(/_/g, ' ')}` : roleLabel;
  return { subtitle, role };
}

export function MessageBanner() {
  const insets = useSafeAreaInsets();
  const { employeeId, isLoggedIn } = useAuthStore();
  const [banner, setBanner] = useState<BannerInfo | null>(null);
  const slide = useRef(new Animated.Value(-200)).current;
  const lastCounts = useRef<Map<string, number>>(new Map());
  const seededRef = useRef(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !employeeId) {
      lastCounts.current.clear();
      seededRef.current = false;
      setBanner(null);
      return;
    }

    const unsub = UsersService.subscribeToUser(employeeId, async (data) => {
      const userData = (data ?? {}) as Partial<User>;
      const list: UnseenEntry[] = Array.isArray(userData.UnseenMessages) ? userData.UnseenMessages : [];

      // First snapshot after login: seed the baseline so existing unread counts
      // don't fire a banner. Only later increases will surface.
      if (!seededRef.current) {
        for (const m of list) lastCounts.current.set(m.UserId, m.Count ?? 0);
        seededRef.current = true;
        return;
      }

      // Find the entry whose count grew the most (or any new sender).
      let triggered: UnseenEntry | null = null;
      for (const m of list) {
        const prev = lastCounts.current.get(m.UserId) ?? 0;
        if ((m.Count ?? 0) > prev) {
          triggered = m;
          break;
        }
      }

      // Update baseline regardless so we don't fire repeatedly for the same delta.
      const nextMap = new Map<string, number>();
      for (const m of list) nextMap.set(m.UserId, m.Count ?? 0);
      lastCounts.current = nextMap;

      if (!triggered) return;

      // Suppress if the user is already inside that ChatRoom.
      const routeName = getCurrentRouteName();
      const params = getCurrentRouteParams<{ userId?: string }>();
      if (routeName === 'ChatRoom' && params?.userId === triggered.UserId) return;

      // Enrich with role + department by reading the sender's user doc.
      let user: User | null = null;
      try {
        user = await UsersService.getUser(triggered.UserId);
      } catch {
        user = null;
      }
      const { subtitle, role } = formatSubtitle(user, triggered.Name);
      setBanner({
        userId: triggered.UserId,
        name: triggered.Name || user?.Name || 'Unknown',
        subtitle,
        role,
        profileImage: user?.ProfileImage,
      });
    });

    return () => unsub();
  }, [employeeId, isLoggedIn]);

  // Slide-in / auto-dismiss animation lifecycle.
  useEffect(() => {
    if (!banner) return;
    Animated.timing(slide, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => closeBanner(), AUTO_DISMISS_MS);
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [banner]);

  function closeBanner() {
    Animated.timing(slide, {
      toValue: -200,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setBanner(null));
  }

  function handlePress() {
    if (!banner) return;
    const target = banner;
    closeBanner();
    navigate('ChatRoom', {
      userId: target.userId,
      userName: target.name,
      userRole: target.role,
      chatType: 'USER',
    });
  }

  if (!banner) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { paddingTop: insets.top + 6, transform: [{ translateY: slide }] },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        style={styles.card}
      >
        <View style={styles.avatar}>
          <UserAvatar profileImage={banner.profileImage} name={banner.name} size={42} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            New message from {banner.name}
          </Text>
          {banner.subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {banner.subtitle}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#FFFFFFCC" />
        <TouchableOpacity
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={(e) => {
            e.stopPropagation?.();
            closeBanner();
          }}
          style={styles.close}
        >
          <Ionicons name="close" size={18} color="#FFFFFFCC" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: 12,
    zIndex: 999,
    elevation: 999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0052CC',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    ...Platform.select({ android: { elevation: 8 } }),
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  body: { flex: 1, gap: 2 },
  title: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  subtitle: { color: '#E0EAFF', fontSize: 12, fontWeight: '500' },
  close: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginLeft: 4,
  },
});
