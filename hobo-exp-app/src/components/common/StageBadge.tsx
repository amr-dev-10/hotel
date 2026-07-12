import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TaskStage } from '../../types';
import { STAGE_LABELS } from '../../utils/constants';

// Arcadia status chip color system
const STAGE_CHIP: Record<TaskStage, { bg: string; text: string }> = {
  Created:   { bg: '#CFFAFE', text: '#164E63' },
  Assigned:  { bg: '#E0E7FF', text: '#312E81' },
  Executed:  { bg: '#FFEDD5', text: '#7C2D12' },
  Completed: { bg: '#D1FAE5', text: '#064E3B' },
};

interface Props {
  stage: TaskStage;
}

export function StageBadge({ stage }: Props) {
  const chip = STAGE_CHIP[stage] ?? { bg: '#E7EEFF', text: '#45464D' };
  const label = STAGE_LABELS[stage] ?? stage;
  return (
    <View style={[styles.badge, { backgroundColor: chip.bg }]}>
      <Text style={[styles.text, { color: chip.text }]}>{label}</Text>
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
