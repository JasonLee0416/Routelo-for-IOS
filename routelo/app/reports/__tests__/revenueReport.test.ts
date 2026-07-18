import { DeliveryOrder, legacyDeliveryToOrder } from '../../domain';
import { FuelLog } from '../../models';
import { DEFAULT_ROUTELO_SETTINGS } from '../../settings';
import {
  buildRevenueReport,
  deriveRange,
  orderRevenue,
  previousRange,
  rangeLengthDays,
} from '../revenueReport';

const settings = DEFAULT_ROUTELO_SETTINGS;

type OrderSpec = {
  id?: string;
  date: string; // serviceDate YYYY-MM-DD
  vendor?: string;
  product?: string;
  address?: string;
  fee?: number;
  status?: 'pending' | 'completed';
};

function order(spec: OrderSpec): DeliveryOrder {
  return legacyDeliveryToOrder({
    id: spec.id ?? `o-${spec.date}-${spec.vendor ?? ''}-${spec.fee ?? ''}`,
    orderVendor: '',
    orderVendorTel: '',
    deliveryVendor: spec.vendor ?? '',
    deliveryVendorTel: '',
    productName: spec.product ?? '',
    productQuantity: 1,
    eventTime: '',
    deliveryDt: spec.date,
    deliveryAddress: spec.address ?? '',
    customerRequests: '',
    recipientTel: '',
    status: spec.status ?? 'completed',
    distanceKm: 0,
    fee: spec.fee ?? 0,
    latitude: 0,
    longitude: 0,
  });
}

const fuel = (date: string, amount: number): FuelLog => ({
  id: `f-${date}-${amount}`,
  date,
  pricePerLiter: 1700,
  liters: amount / 1700,
  amount,
  odometerKm: 0,
});

describe('range helpers', () => {
  it('rangeLengthDays counts both ends inclusively', () => {
    expect(rangeLengthDays({ start: '2026-07-01', end: '2026-07-01' })).toBe(1);
    expect(rangeLengthDays({ start: '2026-07-01', end: '2026-07-07' })).toBe(7);
    expect(rangeLengthDays({ start: '2026-07-07', end: '2026-07-01' })).toBe(0);
  });

  it('deriveRange spans min..max serviceDate, null when none', () => {
    expect(
      deriveRange([order({ date: '2026-07-05' }), order({ date: '2026-07-02' })]),
    ).toEqual({ start: '2026-07-02', end: '2026-07-05' });
    expect(deriveRange([])).toBeNull();
  });

  it('previousRange is the equal-length window immediately before', () => {
    expect(previousRange({ start: '2026-07-08', end: '2026-07-14' })).toEqual({
      start: '2026-07-01',
      end: '2026-07-07',
    });
  });
});

describe('orderRevenue', () => {
  it('prefers the saved fee', () => {
    expect(orderRevenue(order({ date: '2026-07-01', fee: 22000 }), settings)).toBe(
      22000,
    );
  });

  it('falls back to district/default fee when no saved fee', () => {
    // 기본 설정에는 모든 구가 DEFAULT_DISTRICT_FEE(15000)로 설정돼 있다.
    expect(
      orderRevenue(order({ date: '2026-07-01', address: '서울 강남구 1' }), settings),
    ).toBe(15000);
    expect(orderRevenue(order({ date: '2026-07-01' }), settings)).toBe(
      settings.fees.defaultFee,
    );
  });
});

describe('buildRevenueReport', () => {
  const orders = [
    order({ date: '2026-07-01', vendor: 'A화원', product: '축하화환', fee: 20000, address: '서울 강남구' }),
    order({ date: '2026-07-01', vendor: 'A화원', product: '근조화환', fee: 30000, address: '서울 서초구', status: 'pending' }),
    order({ date: '2026-07-02', vendor: 'B플라워', product: '축하화환', fee: 25000, address: '서울 강남구' }),
  ];
  const fuelLogs = [fuel('2026-07-01', 10000)];

  it('totals match the profit summary (revenue/fuel/net/count/activeDays)', () => {
    const r = buildRevenueReport(orders, fuelLogs, settings);
    expect(r.totals.revenue).toBe(75000);
    expect(r.totals.fuelCost).toBe(10000);
    expect(r.totals.net).toBe(65000);
    expect(r.totals.count).toBe(3);
    expect(r.totals.activeDays).toBe(2);
  });

  it('completion rate reflects completed vs total', () => {
    const r = buildRevenueReport(orders, fuelLogs, settings);
    expect(r.completion).toEqual({ total: 3, completed: 2, rate: 67 });
  });

  it('averages are per-delivery / per-active-day and margin', () => {
    const r = buildRevenueReport(orders, fuelLogs, settings);
    expect(r.averages.revenuePerDelivery).toBe(25000);
    expect(r.averages.revenuePerActiveDay).toBe(37500); // 75000 / 2
    expect(r.averages.netMarginPct).toBeCloseTo(86.7, 1); // 65000/75000
  });

  it('breaks down by category / region / vendor sorted by revenue with shares', () => {
    const r = buildRevenueReport(orders, fuelLogs, settings);

    const cat = r.byCategory.map((row) => [row.label, row.revenue, row.count]);
    expect(cat).toEqual([
      ['축하', 45000, 2],
      ['근조', 30000, 1],
    ]);
    expect(r.byCategory[0].share).toBeCloseTo(0.6, 5); // 45000/75000

    const region = r.byRegion.map((row) => [row.label, row.revenue]);
    expect(region).toEqual([
      ['강남구', 45000],
      ['서초구', 30000],
    ]);

    const vendor = r.byVendor.map((row) => [row.label, row.revenue]);
    expect(vendor).toEqual([
      ['A화원', 50000],
      ['B플라워', 25000],
    ]);
  });

  it('labels unclassified / unmapped buckets', () => {
    const r = buildRevenueReport(
      [order({ date: '2026-07-01', fee: 15000 })],
      [],
      settings,
    );
    expect(r.byCategory[0].label).toBe('미분류');
    expect(r.byRegion[0].label).toBe('지역 미지정');
    expect(r.byVendor[0].label).toBe('거래처 미지정');
  });

  it('picks the highest-net day as topDay', () => {
    const r = buildRevenueReport(orders, fuelLogs, settings);
    // 07-01: 매출 50000 - 주유 10000 = 40000, 07-02: 25000. → 07-01
    expect(r.topDay).toEqual({ date: '2026-07-01', net: 40000 });
  });

  it('has no comparison without an explicit range', () => {
    expect(buildRevenueReport(orders, fuelLogs, settings).comparison).toBeNull();
  });

  it('compares against the previous equal-length window when ranged', () => {
    const all = [
      order({ date: '2026-06-25', fee: 10000 }), // 직전 주(06-24~06-30)
      order({ date: '2026-07-02', fee: 30000 }), // 이번 주(07-01~07-07)
      order({ date: '2026-07-03', fee: 30000 }),
    ];
    const r = buildRevenueReport(all, [], settings, {
      start: '2026-07-01',
      end: '2026-07-07',
    });
    expect(r.totals.revenue).toBe(60000);
    expect(r.comparison).not.toBeNull();
    expect(r.comparison!.revenue).toBe(10000); // 직전 주 매출
    expect(r.comparison!.revenueDelta).toBe(50000);
    expect(r.comparison!.revenueDeltaPct).toBe(500); // +500%
    expect(r.comparison!.countDelta).toBe(1); // 2 - 1
  });

  it('reports null delta pct when the previous window is empty', () => {
    const r = buildRevenueReport(
      [order({ date: '2026-07-02', fee: 30000 })],
      [],
      settings,
      { start: '2026-07-01', end: '2026-07-07' },
    );
    expect(r.comparison!.revenue).toBe(0);
    expect(r.comparison!.revenueDeltaPct).toBeNull();
    expect(r.comparison!.revenueDelta).toBe(30000);
  });

  it('scopes everything to the range (out-of-range orders excluded)', () => {
    const all = [
      order({ date: '2026-06-30', fee: 99000 }),
      order({ date: '2026-07-02', fee: 30000 }),
    ];
    const r = buildRevenueReport(all, [], settings, {
      start: '2026-07-01',
      end: '2026-07-07',
    });
    expect(r.totals.revenue).toBe(30000);
    expect(r.totals.count).toBe(1);
  });
});
