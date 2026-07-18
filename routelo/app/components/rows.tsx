import { Ionicons } from '../platform/icons';
import { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../theme/context';

// List-row presentationals (notification card, settings row) extracted from the
// screen monolith. Plain props + useTheme only.

export type NotificationTone = 'danger' | 'warning' | 'info';

export function NotificationCard({
  tone,
  title,
  body,
  time,
  icon,
}: {
  tone: NotificationTone;
  title: string;
  body: string;
  time: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const { C, styles } = useTheme();
  const color = tone === 'danger' ? C.danger : tone === 'warning' ? C.warning : C.primary;
  const background =
    tone === 'danger' ? C.dangerBg : tone === 'warning' ? C.warningBg : C.primaryContainer;
  return (
    <View style={styles.notificationCard}>
      <View style={[styles.notificationIcon, { backgroundColor: background }]}>
        <Ionicons name={icon} size={21} color={color} />
      </View>
      <View style={styles.flex}>
        <View style={styles.rowBetween}>
          <Text style={[styles.notificationUrgency, { color }]}>
            {tone === 'danger' ? '긴급' : tone === 'warning' ? '주의' : '안내'}
          </Text>
          <Text style={styles.notificationTime}>{time}</Text>
        </View>
        <Text style={styles.notificationTitle}>{title}</Text>
        <Text style={styles.notificationBody}>{body}</Text>
      </View>
    </View>
  );
}

export function SettingRow({
  icon,
  title,
  caption,
  trailing,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  caption: string;
  trailing?: ReactNode;
  onPress?: () => void;
}) {
  const { C, styles } = useTheme();
  return (
    <Pressable
      style={styles.settingRow}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}. ${caption}`}
    >
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={21} color={C.primary} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingCaption}>{caption}</Text>
      </View>
      {trailing || <Ionicons name="chevron-forward" size={20} color={C.textMuted} />}
    </Pressable>
  );
}
