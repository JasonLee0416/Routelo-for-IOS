import * as Notifications from 'expo-notifications';

import { PlannedNotification } from './notificationPlan';

// Thin side-effect wrappers over expo-notifications. The scheduling *decisions*
// live in the pure, tested `notificationPlan` module; this file only talks to
// the OS. Not unit-tested (native surface) — verified via a device/simulator build.

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
): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const item of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: item.id,
      content: { title: item.title, body: item.body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(item.fireAtMs),
      },
    });
  }
}

export async function cancelAllScheduledNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
