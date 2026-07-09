import { DeliveryOrder } from '../../domain';
import { planDeliveryNotifications } from '../notificationPlan';

const NOW = Date.UTC(2026, 6, 10, 0, 0); // 2026-07-10 09:00 KST

const order = (over: Partial<DeliveryOrder> = {}): DeliveryOrder =>
  ({
    schemaVersion: 1,
    id: 'd1',
    orderingVendor: {},
    fulfillingVendor: {},
    product: { name: '축하 3단 화환' },
    schedule: { timezone: 'Asia/Seoul', timePrecision: 'exact', priority: 'normal' },
    destination: { address: '강남구 테헤란로 152' },
    recipient: {},
    status: 'pending',
    settlement: {},
    source: { type: 'manual' },
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as DeliveryOrder;

describe('planDeliveryNotifications', () => {
  test('schedules a deadline notification leadMinutes before, in the future', () => {
    const orders = [
      order({
        schedule: {
          timezone: 'Asia/Seoul',
          timePrecision: 'exact',
          priority: 'critical',
          strictDeadlineAt: '2026-07-10T13:00:00+09:00', // 04:00 UTC
        },
      }),
    ];
    const plan = planDeliveryNotifications(orders, { nowMs: NOW, leadMinutes: 30 });
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ id: 'routelo:d1:deadline', kind: 'deadline' });
    expect(plan[0].fireAtMs).toBe(Date.UTC(2026, 6, 10, 3, 30)); // 04:00 UTC − 30m
    expect(plan[0].title).toBe('엄수 마감 30분 전');
    expect(plan[0].body).toContain('축하 3단 화환');
    expect(plan[0].body).toContain('13:00');
  });

  test('skips completed/cancelled deliveries', () => {
    const base = {
      timezone: 'Asia/Seoul',
      timePrecision: 'exact' as const,
      priority: 'normal' as const,
      strictDeadlineAt: '2026-07-10T13:00:00+09:00',
    };
    expect(
      planDeliveryNotifications(
        [order({ status: 'completed', schedule: base }), order({ id: 'd2', status: 'cancelled', schedule: base })],
        { nowMs: NOW },
      ),
    ).toEqual([]);
  });

  test('skips fire times already in the past', () => {
    const plan = planDeliveryNotifications(
      [order({ schedule: { timezone: 'Asia/Seoul', timePrecision: 'exact', priority: 'normal', strictDeadlineAt: '2026-07-10T09:10:00+09:00' } })],
      { nowMs: NOW, leadMinutes: 30 }, // 09:10 KST − 30m = 08:40 KST < now(09:00)
    );
    expect(plan).toEqual([]);
  });

  test('includes deadline and event, sorted by fire time', () => {
    const plan = planDeliveryNotifications(
      [
        order({
          schedule: {
            timezone: 'Asia/Seoul',
            timePrecision: 'exact',
            priority: 'critical',
            strictDeadlineAt: '2026-07-10T13:00:00+09:00',
            eventAt: '2026-07-10T14:00:00+09:00',
          },
        }),
      ],
      { nowMs: NOW, leadMinutes: 30 },
    );
    expect(plan.map((p) => p.kind)).toEqual(['deadline', 'event']);
    expect(plan[0].fireAtMs).toBeLessThan(plan[1].fireAtMs);
  });

  test('ignores orders with no scheduled times', () => {
    expect(planDeliveryNotifications([order()], { nowMs: NOW })).toEqual([]);
  });
});
