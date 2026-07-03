export type DeadlineStatus = 'overdue' | 'soon' | 'normal' | 'none';

// Classifies how urgent a delivery's strict deadline is, relative to `nowMs`
// (pass Date.now() at the call site so this stays pure and testable). The
// deadline string is the legacy "YYYY-MM-DD HH:mm" form and is read as Korea
// time (KST, UTC+9). Date-only values have no time deadline -> 'none'.
export function deadlineStatus(
  deliveryDt: string | undefined | null,
  nowMs: number,
  soonMinutes = 60,
): DeadlineStatus {
  if (!deliveryDt) return 'none';
  const match = deliveryDt
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!match) return 'none';
  const [, year, month, day, hour, minute] = match;
  if (hour === undefined) return 'none';
  // Interpret the wall-clock time as KST, then convert to a UTC timestamp.
  const targetMs =
    Date.UTC(+year, +month - 1, +day, +hour, +minute) - 9 * 60 * 60 * 1000;
  const diffMinutes = (targetMs - nowMs) / 60000;
  if (diffMinutes < 0) return 'overdue';
  if (diffMinutes <= soonMinutes) return 'soon';
  return 'normal';
}
