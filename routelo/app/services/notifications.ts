import notifee, {
  AuthorizationStatus,
  TriggerType,
  type TimestampTrigger,
} from '@notifee/react-native';

import { PlannedNotification } from './notificationPlan';
import { NotificationSettings } from '../settings/schema';

// Thin side-effect wrappers over notifee. The scheduling *decisions* live in
// the pure, tested `notificationPlan` module; this file only talks to the OS.
// Not unit-tested (native surface) — verified via a device build.

// 알림 방식/알림음 설정 → 알림 사운드 값.
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

// resolveNotificationSound 계약(string|boolean) → notifee ios.sound 파라미터.
function toIosSound(sound: string | boolean): string | undefined {
  if (sound === false) return undefined; // 무음
  if (sound === true) return 'default';
  return sound;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
}

// Reconcile the OS-scheduled local notifications with the desired plan: cancel
// everything this app scheduled, then (re)schedule the plan. Safe to call
// whenever deliveries or the reminder setting change.
export async function syncScheduledNotifications(
  plan: PlannedNotification[],
  soundSettings?: Pick<NotificationSettings, 'alertMode' | 'soundName'>,
): Promise<void> {
  const sound = toIosSound(
    soundSettings ? resolveNotificationSound(soundSettings) : true,
  );
  await notifee.cancelTriggerNotifications();
  for (const item of plan) {
    // notifee rejects past timestamps; the plan should only contain future
    // items but guard anyway so one stale entry can't break the whole sync.
    if (item.fireAtMs <= Date.now()) continue;
    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: item.fireAtMs,
    };
    await notifee.createTriggerNotification(
      {
        id: item.id,
        title: item.title,
        body: item.body,
        ios: { sound },
      },
      trigger,
    );
  }
}

// 설정 화면 "테스트" 버튼: 선택한 방식/알림음으로 즉시 로컬 알림을 한 번 발송해 미리듣기.
export async function sendTestNotification(
  settings: Pick<NotificationSettings, 'alertMode' | 'soundName'>,
): Promise<void> {
  const ok = await ensureNotificationPermission();
  if (!ok) return;
  await notifee.displayNotification({
    title: 'RouteLO 알림 미리듣기',
    body:
      settings.alertMode === 'vibration'
        ? '진동으로 알립니다.'
        : '선택한 알림음으로 알립니다.',
    ios: { sound: toIosSound(resolveNotificationSound(settings)) },
  });
}

export async function cancelAllScheduledNotifications(): Promise<void> {
  await notifee.cancelTriggerNotifications();
}
