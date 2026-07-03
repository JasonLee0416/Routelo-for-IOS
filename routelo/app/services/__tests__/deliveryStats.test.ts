import { Delivery } from '../../models';
import { summarizeDeliveryStats } from '../deliveryStats';

const d = (
  id: string,
  status: Delivery['status'],
  fee = 0,
): Delivery => ({ id, status, fee } as Delivery);

describe('summarizeDeliveryStats', () => {
  test('counts total, completed, pending and rounds the rate', () => {
    expect(
      summarizeDeliveryStats([
        d('1', 'completed'),
        d('2', 'completed'),
        d('3', 'pending'),
      ]),
    ).toEqual({
      total: 3,
      completed: 2,
      pending: 1,
      completionRate: 67, // 66.6 -> 67
      completedRevenue: 0,
      pendingRevenue: 0,
    });
  });

  test('splits revenue into completed vs still-to-earn', () => {
    const stats = summarizeDeliveryStats([
      d('1', 'completed', 15000),
      d('2', 'pending', 12000),
      d('3', 'pending', 8000),
    ]);
    expect(stats.completedRevenue).toBe(15000);
    expect(stats.pendingRevenue).toBe(20000);
  });

  test('ignores non-finite fees', () => {
    const stats = summarizeDeliveryStats([
      { id: '1', status: 'pending' } as Delivery, // no fee field
      d('2', 'pending', 10000),
    ]);
    expect(stats.pendingRevenue).toBe(10000);
  });

  test('is all zero for an empty list', () => {
    expect(summarizeDeliveryStats([])).toEqual({
      total: 0,
      completed: 0,
      pending: 0,
      completionRate: 0,
      completedRevenue: 0,
      pendingRevenue: 0,
    });
  });

  test('reports 100 when everything is completed', () => {
    expect(summarizeDeliveryStats([d('1', 'completed')]).completionRate).toBe(
      100,
    );
  });
});
