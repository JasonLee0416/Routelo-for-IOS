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

export type ProfitPeriod = 'daily' | 'weekly' | 'monthly';

export type ProfitBucket = {
  key: string; // stable bucket id (e.g. '2026-07-03', '2026-06-29', '2026-07')
  label: string; // short display label
  startDate: string; // YYYY-MM-DD of the bucket start, used for ordering
  revenue: number;
  fuelCost: number;
  net: number;
  count: number;
};

export type ProfitTotals = {
  revenue: number;
  fuelCost: number;
  net: number;
  count: number;
  activeDays: number;
};

// Monday-start week for a YYYY-MM-DD string. Parsed as UTC so the result is
// deterministic and independent of the device's timezone or the current time.
export function weekStartDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

function bucketFor(
  dateStr: string,
  period: ProfitPeriod,
): { key: string; label: string; startDate: string } {
  const [year, month, day] = dateStr.split('-');
  if (period === 'daily') {
    return { key: dateStr, label: `${month}.${day}`, startDate: dateStr };
  }
  if (period === 'weekly') {
    const start = weekStartDate(dateStr);
    const [, sm, sd] = start.split('-');
    return { key: start, label: `${sm}.${sd} 주`, startDate: start };
  }
  const monthKey = `${year}-${month}`;
  return { key: monthKey, label: `${year}.${month}`, startDate: `${monthKey}-01` };
}

// Rolls daily summaries into daily / weekly / monthly buckets, sorted ascending
// by start date. Drives the profit chart series.
export function bucketProfit(
  daily: Map<string, DailyProfitSummary>,
  period: ProfitPeriod,
): ProfitBucket[] {
  const buckets = new Map<string, ProfitBucket>();
  daily.forEach((summary, date) => {
    const { key, label, startDate } = bucketFor(date, period);
    const bucket =
      buckets.get(key) ||
      ({ key, label, startDate, revenue: 0, fuelCost: 0, net: 0, count: 0 } as ProfitBucket);
    bucket.revenue += summary.revenue;
    bucket.fuelCost += summary.fuelCost;
    bucket.count += summary.count;
    buckets.set(key, bucket);
  });
  const list = [...buckets.values()];
  list.forEach((bucket) => {
    bucket.net = bucket.revenue - bucket.fuelCost;
  });
  return list.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

// Totals across every day that has activity (revenue and/or fuel).
export function totalProfit(daily: Map<string, DailyProfitSummary>): ProfitTotals {
  const totals: ProfitTotals = {
    revenue: 0,
    fuelCost: 0,
    net: 0,
    count: 0,
    activeDays: 0,
  };
  daily.forEach((summary) => {
    totals.revenue += summary.revenue;
    totals.fuelCost += summary.fuelCost;
    totals.count += summary.count;
    totals.activeDays += 1;
  });
  totals.net = totals.revenue - totals.fuelCost;
  return totals;
}
