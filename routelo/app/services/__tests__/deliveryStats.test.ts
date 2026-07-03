import { Delivery } from '../../models';
import { summarizeDeliveryStats } from '../deliveryStats';

const d = (id: string, status: Delivery['status']): Delivery =>
  ({ id, status } as Delivery);

describe('summarizeDeliveryStats', () => {
  test('counts total, completed, pending and rounds the rate', () => {
    expect(
      summarizeDeliveryStats([
        d('1', 'completed'),
        d('2', 'completed'),
        d('3', 'pending'),
      ]),
    ).toEqual({ total: 3, completed: 2, pending: 1, completionRate: 67 }); // 66.6 -> 67
  });

  test('is all zero (rate 0) for an empty list', () => {
    expect(summarizeDeliveryStats([])).toEqual({
      total: 0,
      completed: 0,
      pending: 0,
      completionRate: 0,
    });
  });

  test('reports 100 when everything is completed', () => {
    expect(
      summarizeDeliveryStats([d('1', 'completed')]).completionRate,
    ).toBe(100);
  });
});
