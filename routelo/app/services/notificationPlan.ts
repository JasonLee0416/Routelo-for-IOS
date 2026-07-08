import { DeliveryOrder } from '../domain';

export type NotificationKind = 'deadline' | 'event';

export type PlannedNotification = {
  id: string; // stable per delivery+kind → safe to reconcile
  deliveryId: string;
  kind: NotificationKind;
  fireAtMs: number;
  title: string;
  body: string;
};

const timeLabel = (iso: string) => iso.match(/T(\d{2}:\d{2})/)?.[1] ?? '';

// Pure: which local notifications should exist for these orders, firing
// `leadMinutes` before each strict deadline / event time. Only future fire
// times for open (non-completed/cancelled) deliveries are included, so the
// result can be re-computed and reconciled at any time. `nowMs` is injected to
// keep it testable.
export function planDeliveryNotifications(
  orders: DeliveryOrder[],
  opts: { nowMs: number; leadMinutes?: number },
): PlannedNotification[] {
  const leadMinutes = opts.leadMinutes ?? 30;
  const leadMs = leadMinutes * 60_000;
  const planned: PlannedNotification[] = [];

  for (const order of orders) {
    if (order.status === 'completed' || order.status === 'cancelled') continue;
    const name = order.product.name?.trim() || '배달';
    const place =
      order.destination.address?.trim() ||
      order.destination.venueName?.trim() ||
      '';

    const add = (kind: NotificationKind, at: string | undefined, label: string) => {
      if (!at) return;
      const atMs = Date.parse(at);
      if (!Number.isFinite(atMs)) return;
      const fireAtMs = atMs - leadMs;
      if (fireAtMs <= opts.nowMs) return; // already past → skip
      planned.push({
        id: `routelo:${order.id}:${kind}`,
        deliveryId: order.id,
        kind,
        fireAtMs,
        title: `${label} ${leadMinutes}분 전`,
        body: `${name} · ${timeLabel(at)}${place ? ` · ${place}` : ''}`,
      });
    };

    add('deadline', order.schedule.strictDeadlineAt, '엄수 마감');
    add('event', order.schedule.eventAt, '예식');
  }

  return planned.sort((a, b) => a.fireAtMs - b.fireAtMs);
}
