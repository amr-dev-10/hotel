import React from 'react';
import { View, Text, Image } from 'react-native';

// Young hospitality-staff avatars (DiceBear "notionists" — modern, polished portraits).
// Mix of male/female young hotel-staff personas.
function dice(seed: string) {
  return `https://api.dicebear.com/7.x/notionists/png?seed=${encodeURIComponent(seed)}&size=200&backgroundColor=transparent`;
}

export const AVATARS = [
  { key: 'av1',  url: dice('Concierge-Liam'),    bg: '#DBEAFE' },   // young man, concierge vibe
  { key: 'av2',  url: dice('Reception-Aria'),    bg: '#FCE7F3' },   // young woman, reception
  { key: 'av3',  url: dice('Bellhop-Noah'),      bg: '#E0E7FF' },   // young man, bellhop
  { key: 'av4',  url: dice('Hostess-Zara'),      bg: '#FEF3C7' },   // young woman, hostess
  { key: 'av5',  url: dice('Waiter-Diego'),      bg: '#D1FAE5' },   // young man, F&B
  { key: 'av6',  url: dice('Spa-Mia'),           bg: '#FFE4E6' },   // young woman, spa
  { key: 'av7',  url: dice('Bartender-Kai'),     bg: '#CFFAFE' },   // young man, bar
  { key: 'av8',  url: dice('Manager-Luna'),      bg: '#EDE9FE' },   // young woman, mgr
  { key: 'av9',  url: dice('Valet-Ethan'),       bg: '#FEF9C3' },   // young man, valet
  { key: 'av10', url: dice('Housekeeping-Iris'), bg: '#ECFCCB' },   // young woman, hk
  { key: 'av11', url: dice('Steward-Arjun'),     bg: '#F0FDF4' },   // young man, steward
  { key: 'av12', url: dice('Front-Office-Nia'),  bg: '#FFEDD5' },   // young woman, front office
];

export function isAvatarKey(v: string | null | undefined): boolean {
  return typeof v === 'string' && AVATARS.some((a) => a.key === v);
}

interface Props {
  profileImage?: string | null;
  name?: string | null;
  size?: number;
}

export function UserAvatar({ profileImage, name, size = 44 }: Props) {
  const r = size / 2;
  const base = { width: size, height: size, borderRadius: r };

  if (profileImage && isAvatarKey(profileImage)) {
    const av = AVATARS.find((a) => a.key === profileImage)!;
    return (
      <View style={[base, { backgroundColor: av.bg, overflow: 'hidden' }]}>
        <Image source={{ uri: av.url }} style={{ width: size, height: size }} />
      </View>
    );
  }

  if (profileImage) {
    return <Image source={{ uri: profileImage }} style={base} />;
  }

  const initial = name?.[0]?.toUpperCase() ?? '?';
  return (
    <View style={[base, { backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ fontSize: size * 0.4, fontWeight: '700', color: '#374151' }}>{initial}</Text>
    </View>
  );
}
