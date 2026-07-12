import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Priority } from '../../types';

// Arcadia pastel chip system
const PRIORITY_CHIP: Record<string, { bg: string; text: string }> = {
  High:      { bg: '#FFDAD6', text: '#93000A' },
  Important: { bg: '#FFDDB8', text: '#684000' },
  Routine:   { bg: '#D1FAE5', text: '#064E3B' },
};

interface Props {
  priority: Priority;
}

export function PriorityBadge({ priority }: Props) {
  const chip = PRIORITY_CHIP[priority] ?? { bg: '#E7EEFF', text: '#45464D' };
  return (
    <View style={[styles.badge, { backgroundColor: chip.bg }]}>
      <Text style={[styles.text, { color: chip.text }]}>{priority}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 50,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
