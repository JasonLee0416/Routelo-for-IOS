import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { Delivery, OcrFieldResult } from '../models';
import { useTheme } from '../theme/context';

// Small self-contained presentational badges/meters, extracted from the screen
// monolith. Each reads the theme via useTheme and takes only plain props.

export function StatusBadge({ status }: { status: Delivery['status'] }) {
  const { C, styles } = useTheme();
  const completed = status === 'completed';
  return (
    <View style={[styles.badge, completed ? styles.successBadge : styles.waitBadge]}>
      <View
        style={[
          styles.badgeDot,
          { backgroundColor: completed ? C.success : C.primary },
        ]}
      />
      <Text
        style={[
          styles.badgeText,
          { color: completed ? C.success : C.primary },
        ]}
      >
        {completed ? '완료' : '배달 대기'}
      </Text>
    </View>
  );
}

export function ConfidenceBadge({ field }: { field: OcrFieldResult }) {
  const { C, styles } = useTheme();
  const confirmed = field.status === 'confirmed';
  const review = field.status === 'review';
  const color = confirmed ? C.success : review ? C.warning : C.danger;
  const background = confirmed ? C.successBg : review ? C.warningBg : C.dangerBg;
  return (
    <View style={[styles.confidenceBadge, { backgroundColor: background }]}>
      <Ionicons
        name={confirmed ? 'checkmark-circle' : review ? 'help-circle' : 'warning'}
        size={14}
        color={color}
      />
      <Text style={[styles.confidenceText, { color }]}>{field.confidence}%</Text>
    </View>
  );
}

export function PhoneKindBadge({ kind }: { kind: 'direct' | 'safe' }) {
  const { C, styles } = useTheme();
  const safe = kind === 'safe';
  const color = safe ? C.warning : C.success;
  const background = safe ? C.warningBg : C.successBg;
  return (
    <View style={[styles.confidenceBadge, { backgroundColor: background }]}>
      <Ionicons
        name={safe ? 'shield-checkmark' : 'call'}
        size={13}
        color={color}
      />
      <Text style={[styles.confidenceText, { color }]}>
        {safe ? '안심번호' : '실번호'}
      </Text>
    </View>
  );
}

export function QualityMeter({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const { C, styles } = useTheme();
  const color = value >= 80 ? C.success : value >= 60 ? C.warning : C.danger;
  return (
    <View style={styles.qualityRow}>
      <View style={styles.qualityLabelGroup}>
        <Ionicons name={icon} size={17} color={color} />
        <Text style={styles.qualityLabel}>{label}</Text>
      </View>
      <View style={styles.qualityTrack}>
        <View style={[styles.qualityFill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.qualityValue, { color }]}>{value}</Text>
    </View>
  );
}
