import { DeliveryOrder } from '../domain';
import { FuelLog } from '../models';
import { RouteloSettings } from '../settings';
import { calculateFeeByAddress } from './maps';

export type DailyProfitSummary = {
  revenue: number;
  fuelCost: number;
  net: number;
  count: number;
};

const emptySummary = (): DailyProfitSummary => ({
  revenue: 0,
  fuelCost: 0,
  net: 0,
  count: 0,
});

export function summarizeDailyProfit(
  orders: DeliveryOrder[],
  fuelLogs: FuelLog[],
  settings: RouteloSettings,
): Map<string, DailyProfitSummary> {
  const grouped = new Map<string, DailyProfitSummary>();

  orders.forEach((order) => {
    const date = order.schedule.serviceDate;
    if (!date) return;

    const current = grouped.get(date) || emptySummary();
    const savedFee = order.settlement.fee || 0;
    current.revenue +=
      savedFee > 0
        ? savedFee
        : calculateFeeByAddress(order.destination.address || '', settings);
    current.count += 1;
    grouped.set(date, current);
  });

  fuelLogs.forEach((log) => {
    const current = grouped.get(log.date) || emptySummary();
    current.fuelCost += log.amount;
    grouped.set(log.date, current);
  });

  grouped.forEach((summary) => {
    summary.net = summary.revenue - summary.fuelCost;
  });

  return grouped;
}
