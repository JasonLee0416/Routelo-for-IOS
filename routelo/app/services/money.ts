const withCommas = (n: number) =>
  Math.abs(Math.round(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const round1 = (n: number) => {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

// Compact Korean money display: 억 / 만 for large values (one decimal),
// comma-grouped digits otherwise. Keeps chart labels short.
export function formatWonShort(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 100_000_000) return `${sign}${round1(abs / 100_000_000)}억`;
  if (abs >= 10_000) return `${sign}${round1(abs / 10_000)}만`;
  return `${sign}${withCommas(abs)}`;
}
