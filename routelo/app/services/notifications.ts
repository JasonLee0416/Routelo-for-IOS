import * as Notifications from 'expo-notifications';

import { PlannedNotification } from './notificationPlan';
import { NotificationSettings } from '../settings/schema';

// Thin side-effect wrappers over expo-notifications. The scheduling *decisions*
// live in the pure, tested `notificationPlan` module; this file only talks to
// the OS. Not unit-tested (native surface) — verified via a device/simulator build.

// 알림 방식/알림음 설정 → expo-notifications content.sound 값.
// - vibration: 무음 알림(iOS는 시스템 설정에 따라 진동만) → false
// - sound/both: 선택 알림음(.wav, 번들됨) 또는 기본음(true)
// iOS는 API 레벨에서 소리와 진동을 분리하지 않아 'sound'와 'both'는 동일하게 소리를 재생한다.
export function resolveNotificationSound(
  settings: Pick<NotificationSettings, 'alertMode' | 'soundName'>,
): string | boolean {
  if (settings.alertMode === 'vibration') return false;
  if (settings.soundName === 'default') return true;
  return `${settings.soundName}.wav`;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

// Reconcile the OS-scheduled local notifications with the desired plan: cancel
// everything this app scheduled, then (re)schedule the plan. Safe to call
// whenever deliveries or the reminder setting change.
export async function syncScheduledNotifications(
  plan: PlannedNotification[],
  soundSettings?: Pick<NotificationSettings, 'alertMode' | 'soundName'>,
): Promise<void> {
  const sound = soundSettings ? resolveNotificationSound(soundSettings) : true;
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const item of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: item.id,
      content: { title: item.title, body: item.body, sound },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(item.fireAtMs),
      },
    });
  }
}

// 설정 화면 "테스트" 버튼: 선택한 방식/알림음으로 즉시 로컬 알림을 한 번 발송해 미리듣기.
export async function sendTestNotification(
  settings: Pick<NotificationSettings, 'alertMode' | 'soundName'>,
): Promise<void> {
  const ok = await ensureNotificationPermission();
  if (!ok) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'RouteLO 알림 미리듣기',
      body:
        settings.alertMode === 'vibration'
          ? '진동으로 알립니다.'
          : '선택한 알림음으로 알립니다.',
      sound: resolveNotificationSound(settings),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
    },
  });
}

export async function cancelAllScheduledNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
