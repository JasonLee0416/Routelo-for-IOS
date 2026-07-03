import { Delivery } from '../models';

export type DeliveryStats = {
  total: number;
  completed: number;
  pending: number;
  completionRate: number; // 0..100, rounded; 0 when there are no deliveries
};

// Aggregates a delivery list into progress figures for the header bar.
export function summarizeDeliveryStats(deliveries: Delivery[]): DeliveryStats {
  const total = deliveries.length;
  const completed = deliveries.filter(
    (delivery) => delivery.status === 'completed',
  ).length;
  return {
    total,
    completed,
    pending: total - completed,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}
