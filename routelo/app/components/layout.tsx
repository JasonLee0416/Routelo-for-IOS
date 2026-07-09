import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { maskAddressForList } from '../services/format';
import { usePrivacy, useTheme } from '../theme/context';

// Small presentational layout components (screen/section headers, metric and
// time-alert cards) extracted from the screen monolith. Each takes plain props
// and reads the theme via useTheme.

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  notificationCount,
  onNotificationPress,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  notificationCount?: number;
  onNotificationPress?: () => void;
}) {
  const { C, styles } = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.screenTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.screenSubtitle}>{subtitle}</Text>}
      </View>
      <Pressable style={styles.headerAction} onPress={onNotificationPress}>
        <Ionicons name="notifications-outline" size={23} color={C.navy} />
        {!!notificationCount && notificationCount > 0 && (
          <View style={styles.notificationCounter}>
            <Text style={styles.notificationCounterText}>{notificationCount}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

export function SectionHeader({
  title,
  caption,
  action,
}: {
  title: string;
  caption?: string;
  action?: ReactNode;
}) {
  const { C, styles } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!caption && <Text style={styles.sectionCaption}>{caption}</Text>}
      </View>
      {action}
    </View>
  );
}

export function MetricCard({
  icon,
  label,
  value,
  tone = 'primary',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tone?: 'primary' | 'success' | 'neutral' | 'warning';
}) {
  const { C, styles } = useTheme();
  const color =
    tone === 'success'
      ? C.success
      : tone === 'warning'
        ? C.warning
        : tone === 'neutral'
          ? C.textMuted
          : C.primary;
  const background =
    tone === 'success'
      ? C.successBg
      : tone === 'warning'
        ? C.warningBg
        : tone === 'neutral'
          ? C.surfaceAlt
          : C.primaryContainer;
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: background }]}>
        <Ionicons name={icon} size={21} color={color} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function TimeAlertCard({
  type,
  time,
  title,
  address,
}: {
  type: 'deadline' | 'event';
  time: string;
  title: string;
  address: string;
}) {
  const { C, styles } = useTheme();
  const { showFullAddressInList } = usePrivacy();
  const event = type === 'event';
  return (
    <View style={[styles.timeAlert, event ? styles.eventAlert : styles.deadlineAlert]}>
      <View style={[styles.timeIcon, { backgroundColor: event ? C.dangerBg : C.warningBg }]}>
        <Ionicons
          name={event ? 'calendar-outline' : 'alarm-outline'}
          size={22}
          color={event ? C.danger : C.warning}
        />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.timeAlertLabel, { color: event ? C.danger : C.warning }]}>
          {event ? '가장 가까운 예식 시간' : '가장 가까운 엄수 마감'}
        </Text>
        <View style={styles.timeAlertTitleRow}>
          <Text style={styles.timeAlertTime}>{time}</Text>
          <Text style={styles.timeAlertTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Text style={styles.timeAlertAddress} numberOfLines={1}>
          {showFullAddressInList ? address : maskAddressForList(address)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
    </View>
  );
}
