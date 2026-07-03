import { Delivery } from '../models';

export type DeliveryStats = {
  total: number;
  completed: number;
  pending: number;
  completionRate: number; // 0..100, rounded; 0 when there are no deliveries
  completedRevenue: number; // sum of fees for completed deliveries
  pendingRevenue: number; // sum of fees still to earn (pending)
};

const feeOf = (delivery: Delivery) =>
  Number.isFinite(delivery.fee) ? delivery.fee : 0;

// Aggregates a delivery list into progress + revenue figures for the header bar.
export function summarizeDeliveryStats(deliveries: Delivery[]): DeliveryStats {
  const total = deliveries.length;
  let completed = 0;
  let completedRevenue = 0;
  let pendingRevenue = 0;
  for (const delivery of deliveries) {
    if (delivery.status === 'completed') {
      completed += 1;
      completedRevenue += feeOf(delivery);
    } else {
      pendingRevenue += feeOf(delivery);
    }
  }
  return {
    total,
    completed,
    pending: total - completed,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    completedRevenue,
    pendingRevenue,
  };
}
