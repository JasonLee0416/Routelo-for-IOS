import { buildDailyProfitCsv } from '../export';
import { DailyProfitSummary } from '../profit';

const day = (
  revenue: number,
  fuelCost: number,
  count: number,
): DailyProfitSummary => ({ revenue, fuelCost, net: revenue - fuelCost, count });

describe('buildDailyProfitCsv', () => {
  test('emits a header, date-sorted rows, and a totals row', () => {
    const daily = new Map<string, DailyProfitSummary>([
      ['2026-07-03', day(20000, 0, 2)],
      ['2026-07-01', day(30000, 5000, 3)],
    ]);
    expect(buildDailyProfitCsv(daily)).toBe(
      [
        'date,revenue,fuelCost,net,count',
        '2026-07-01,30000,5000,25000,3',
        '2026-07-03,20000,0,20000,2',
        '합계,50000,5000,45000,5',
      ].join('\n'),
    );
  });

  test('an empty map still yields the header and a zero totals row', () => {
    expect(buildDailyProfitCsv(new Map())).toBe(
      ['date,revenue,fuelCost,net,count', '합계,0,0,0,0'].join('\n'),
    );
  });
});
