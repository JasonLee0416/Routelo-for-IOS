import { DailyProfitSummary } from './profit';

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// Builds a CSV of the per-day profit summary (ascending by date) with a totals
// row, ready to share as text. Pure so it can be unit-tested.
export function buildDailyProfitCsv(
  daily: Map<string, DailyProfitSummary>,
): string {
  const header = ['date', 'revenue', 'fuelCost', 'net', 'count'];
  const rows = [...daily.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, summary]) => [
      date,
      summary.revenue,
      summary.fuelCost,
      summary.net,
      summary.count,
    ]);
  const totals = rows.reduce(
    (acc, [, revenue, fuelCost, net, count]) => ({
      revenue: acc.revenue + Number(revenue),
      fuelCost: acc.fuelCost + Number(fuelCost),
      net: acc.net + Number(net),
      count: acc.count + Number(count),
    }),
    { revenue: 0, fuelCost: 0, net: 0, count: 0 },
  );
  const totalRow = [
    '합계',
    totals.revenue,
    totals.fuelCost,
    totals.net,
    totals.count,
  ];
  return [header, ...rows, totalRow]
    .map((row) => row.map(csvCell).join(','))
    .join('\n');
}
