import { deadlineStatus } from '../deadline';

// 2026-07-10 13:00 KST expressed as a UTC timestamp.
const target = Date.UTC(2026, 6, 10, 4, 0);
const min = (n: number) => n * 60000;

describe('deadlineStatus', () => {
  test('overdue once the deadline has passed', () => {
    expect(deadlineStatus('2026-07-10 13:00', target + min(1))).toBe('overdue');
  });

  test('soon within the window (default 60m, inclusive)', () => {
    expect(deadlineStatus('2026-07-10 13:00', target)).toBe('soon');
    expect(deadlineStatus('2026-07-10 13:00', target - min(30))).toBe('soon');
    expect(deadlineStatus('2026-07-10 13:00', target - min(60))).toBe('soon');
  });

  test('normal when comfortably ahead', () => {
    expect(deadlineStatus('2026-07-10 13:00', target - min(61))).toBe('normal');
    expect(deadlineStatus('2026-07-10 13:00', target - min(180))).toBe('normal');
  });

  test('none for date-only, empty, or malformed values', () => {
    expect(deadlineStatus('2026-07-10', target)).toBe('none');
    expect(deadlineStatus('', target)).toBe('none');
    expect(deadlineStatus(undefined, target)).toBe('none');
    expect(deadlineStatus('nope', target)).toBe('none');
  });

  test('respects a custom soon window', () => {
    expect(deadlineStatus('2026-07-10 13:00', target - min(90), 120)).toBe(
      'soon',
    );
  });
});
