// 상세 수익 리포트(Pro). 기존 profit.ts(일별 집계)를 재사용해 총계는 화면의
// 수익 차트와 항상 일치시키고, 그 위에 "기간 비교 · 분류/지역/거래처별 분해 ·
// 평균/완료율" 같은 심화 지표를 순수 함수로 얹는다. 네이티브 의존성이 없어
// 그대로 유닛 테스트할 수 있다.
import { DeliveryOrder } from '../domain';
import { ProductCategory } from '../domain/models';
import { FuelLog } from '../models';
import { RouteloSettings } from '../settings';
import { calculateFeeByAddress, findDistrictByAddress } from '../services/maps';
import {
  ProfitTotals,
  summarizeDailyProfit,
  totalProfit,
} from '../services/profit';

export type ReportRange = { start: string; end: string }; // 양끝 포함 YYYY-MM-DD

export type ReportBreakdownRow = {
  key: string;
  label: string;
  count: number;
  revenue: number;
  share: number; // 총 매출 대비 비중 0..1
};

export type ReportComparison = {
  revenue: number; // 직전 동일 길이 기간의 매출
  net: number;
  count: number;
  revenueDelta: number; // 현재 - 직전
  revenueDeltaPct: number | null; // 직전이 0이면 null
  netDelta: number;
  netDeltaPct: number | null;
  countDelta: number;
};

export type RevenueReport = {
  range: ReportRange | null;
  totals: ProfitTotals; // revenue/fuelCost/net/count/activeDays
  completion: { total: number; completed: number; rate: number }; // rate 0..100
  averages: {
    revenuePerDelivery: number;
    netPerDelivery: number;
    revenuePerActiveDay: number;
    netMarginPct: number | null; // net/revenue*100, revenue 0이면 null
  };
  byCategory: ReportBreakdownRow[];
  byRegion: ReportBreakdownRow[];
  byVendor: ReportBreakdownRow[];
  topDay: { date: string; net: number } | null;
  comparison: ReportComparison | null; // 명시 기간이 있을 때만
};

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  congratulation: '축하',
  condolence: '근조',
  plant: '화분·식물',
  other: '기타',
};
const UNCLASSIFIED = '미분류';
const NO_REGION = '지역 미지정';
const NO_VENDOR = '거래처 미지정';

// summarizeDailyProfit과 동일한 매출 산식(저장 요금 우선, 없으면 주소 기반 요금).
// 분해(분류/지역/거래처)를 위해 주문 단위로 노출한다.
export function orderRevenue(
  order: DeliveryOrder,
  settings: RouteloSettings,
): number {
  const saved = order.settlement.fee || 0;
  return saved > 0
    ? saved
    : calculateFeeByAddress(order.destination.address || '', settings);
}

const isoDay = (dateStr: string) => new Date(`${dateStr}T00:00:00Z`);
const toDay = (date: Date) => date.toISOString().slice(0, 10);

function addDays(dateStr: string, days: number): string {
  const date = isoDay(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return toDay(date);
}

// 양끝 포함 일수. start>end면 0.
export function rangeLengthDays(range: ReportRange): number {
  const start = isoDay(range.start).getTime();
  const end = isoDay(range.end).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 86400000) + 1;
}

// 데이터의 최소~최대 serviceDate로 전체 범위를 만든다. 날짜가 하나도 없으면 null.
export function deriveRange(orders: DeliveryOrder[]): ReportRange | null {
  let min: string | undefined;
  let max: string | undefined;
  for (const order of orders) {
    const date = order.schedule.serviceDate;
    if (!date) continue;
    if (min === undefined || date < min) min = date;
    if (max === undefined || date > max) max = date;
  }
  return min && max ? { start: min, end: max } : null;
}

// 현재 기간 바로 앞의 동일 길이 기간.
export function previousRange(range: ReportRange): ReportRange {
  const len = rangeLengthDays(range);
  const end = addDays(range.start, -1);
  const start = addDays(end, -(Math.max(len, 1) - 1));
  return { start, end };
}

function inRange(date: string | undefined, range: ReportRange | null): boolean {
  if (!range) return true;
  if (!date) return false;
  return date >= range.start && date <= range.end;
}

export function filterOrdersByRange(
  orders: DeliveryOrder[],
  range: ReportRange | null,
): DeliveryOrder[] {
  if (!range) return orders;
  return orders.filter((o) => inRange(o.schedule.serviceDate, range));
}

function filterFuelByRange(
  fuelLogs: FuelLog[],
  range: ReportRange | null,
): FuelLog[] {
  if (!range) return fuelLogs;
  return fuelLogs.filter((f) => inRange(f.date, range));
}

function breakdown(
  orders: DeliveryOrder[],
  settings: RouteloSettings,
  keyOf: (order: DeliveryOrder) => { key: string; label: string },
): ReportBreakdownRow[] {
  const rows = new Map<string, ReportBreakdownRow>();
  let total = 0;
  for (const order of orders) {
    const { key, label } = keyOf(order);
    const revenue = orderRevenue(order, settings);
    total += revenue;
    const row =
      rows.get(key) || { key, label, count: 0, revenue: 0, share: 0 };
    row.count += 1;
    row.revenue += revenue;
    rows.set(key, row);
  }
  const list = [...rows.values()];
  for (const row of list) row.share = total > 0 ? row.revenue / total : 0;
  // 매출 내림차순, 동률이면 라벨 오름차순으로 안정 정렬.
  return list.sort(
    (a, b) => b.revenue - a.revenue || a.label.localeCompare(b.label),
  );
}

function comparisonBetween(
  current: ProfitTotals,
  previous: ProfitTotals,
): ReportComparison {
  const pct = (delta: number, base: number) =>
    base > 0 ? Math.round((delta / base) * 1000) / 10 : null;
  const revenueDelta = current.revenue - previous.revenue;
  const netDelta = current.net - previous.net;
  return {
    revenue: previous.revenue,
    net: previous.net,
    count: previous.count,
    revenueDelta,
    revenueDeltaPct: pct(revenueDelta, previous.revenue),
    netDelta,
    netDeltaPct: pct(netDelta, Math.abs(previous.net)),
    countDelta: current.count - previous.count,
  };
}

export function buildRevenueReport(
  orders: DeliveryOrder[],
  fuelLogs: FuelLog[],
  settings: RouteloSettings,
  explicitRange?: ReportRange,
): RevenueReport {
  const range = explicitRange ?? null;
  const scoped = filterOrdersByRange(orders, range);
  const scopedFuel = filterFuelByRange(fuelLogs, range);

  const daily = summarizeDailyProfit(scoped, scopedFuel, settings);
  const totals = totalProfit(daily);

  const completed = scoped.filter((o) => o.status === 'completed').length;
  const completion = {
    total: scoped.length,
    completed,
    rate: scoped.length > 0 ? Math.round((completed / scoped.length) * 100) : 0,
  };

  const round = (n: number) => Math.round(n);
  const averages = {
    revenuePerDelivery: totals.count > 0 ? round(totals.revenue / totals.count) : 0,
    netPerDelivery: totals.count > 0 ? round(totals.net / totals.count) : 0,
    revenuePerActiveDay:
      totals.activeDays > 0 ? round(totals.revenue / totals.activeDays) : 0,
    netMarginPct:
      totals.revenue > 0
        ? Math.round((totals.net / totals.revenue) * 1000) / 10
        : null,
  };

  const byCategory = breakdown(scoped, settings, (o) => {
    const cat = o.product.category;
    return cat
      ? { key: cat, label: CATEGORY_LABEL[cat] }
      : { key: '__none__', label: UNCLASSIFIED };
  });
  const byRegion = breakdown(scoped, settings, (o) => {
    const district = findDistrictByAddress(o.destination.address || '', settings);
    return district
      ? { key: district, label: district }
      : { key: '__none__', label: NO_REGION };
  });
  const byVendor = breakdown(scoped, settings, (o) => {
    const name = o.fulfillingVendor.name?.trim();
    return name ? { key: name, label: name } : { key: '__none__', label: NO_VENDOR };
  });

  let topDay: { date: string; net: number } | null = null;
  daily.forEach((summary, date) => {
    if (!topDay || summary.net > topDay.net) topDay = { date, net: summary.net };
  });

  let comparison: ReportComparison | null = null;
  if (range) {
    const prevRange = previousRange(range);
    const prevOrders = filterOrdersByRange(orders, prevRange);
    const prevFuel = filterFuelByRange(fuelLogs, prevRange);
    const prevTotals = totalProfit(
      summarizeDailyProfit(prevOrders, prevFuel, settings),
    );
    comparison = comparisonBetween(totals, prevTotals);
  }

  return {
    range,
    totals,
    completion,
    averages,
    byCategory,
    byRegion,
    byVendor,
    topDay,
    comparison,
  };
}
