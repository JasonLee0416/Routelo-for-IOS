import {
  bucketProfit,
  DailyProfitSummary,
  ProfitBucket,
  totalProfit,
  weekStartDate,
} from '../profit';

const day = (
  revenue: number,
  fuelCost: number,
  count: number,
): DailyProfitSummary => ({
  revenue,
  fuelCost,
  net: revenue - fuelCost,
  count,
});

// Two dates in the same Mon–Sun week, one in the next week, one next month.
const daily = new Map<string, DailyProfitSummary>([
  ['2026-07-01', day(30000, 5000, 3)], // Wed
  ['2026-07-03', day(20000, 0, 2)], // Fri (same week as 07-01)
  ['2026-07-06', day(10000, 4000, 1)], // Mon (next week)
  ['2026-08-04', day(50000, 6000, 4)], // next month
]);

describe('weekStartDate', () => {
  test('returns the Monday of the week (deterministic, UTC)', () => {
    expect(weekStartDate('2026-07-01')).toBe('2026-06-29');
    expect(weekStartDate('2026-07-03')).toBe('2026-06-29');
    expect(weekStartDate('2026-07-06')).toBe('2026-07-06');
  });

  test('every weekly bucket start is a Monday', () => {
    bucketProfit(daily, 'weekly').forEach((bucket) => {
      expect(new Date(`${bucket.startDate}T00:00:00Z`).getUTCDay()).toBe(1);
    });
  });
});

describe('bucketProfit', () => {
  test('daily keeps one bucket per date, ascending', () => {
    const buckets = bucketProfit(daily, 'daily');
    expect(buckets.map((b) => b.key)).toEqual([
      '2026-07-01',
      '2026-07-03',
      '2026-07-06',
      '2026-08-04',
    ]);
    expect(buckets[0]).toMatchObject({ revenue: 30000, fuelCost: 5000, net: 25000, count: 3, label: '07.01' });
  });

  test('weekly merges same-week days and computes net', () => {
    const buckets = bucketProfit(daily, 'weekly');
    const firstWeek = buckets.find((b) => b.key === '2026-06-29') as ProfitBucket;
    expect(firstWeek).toMatchObject({
      revenue: 50000, // 30000 + 20000
      fuelCost: 5000,
      net: 45000,
      count: 5,
    });
    // 07-06 is its own week; 08-04 (Tue) rolls into the week of Mon 08-03
    expect(buckets.map((b) => b.key)).toEqual([
      '2026-06-29',
      '2026-07-06',
      '2026-08-03',
    ]);
  });

  test('monthly groups by YYYY-MM', () => {
    const buckets = bucketProfit(daily, 'monthly');
    expect(buckets.map((b) => b.key)).toEqual(['2026-07', '2026-08']);
    expect(buckets[0]).toMatchObject({
      revenue: 60000, // 30000 + 20000 + 10000
      fuelCost: 9000, // 5000 + 4000
      net: 51000,
      count: 6,
      label: '2026.07',
      startDate: '2026-07-01',
    });
  });

  test('empty input yields no buckets', () => {
    expect(bucketProfit(new Map(), 'monthly')).toEqual([]);
  });
});

describe('totalProfit', () => {
  test('sums revenue, fuel, net, count and active days', () => {
    expect(totalProfit(daily)).toEqual({
      revenue: 110000,
      fuelCost: 15000,
      net: 95000,
      count: 10,
      activeDays: 4,
    });
  });
});
