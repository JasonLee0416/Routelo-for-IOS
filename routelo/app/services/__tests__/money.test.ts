import { formatWonShort } from '../money';

describe('formatWonShort', () => {
  test('comma-groups values under 10,000', () => {
    expect(formatWonShort(0)).toBe('0');
    expect(formatWonShort(5100)).toBe('5,100');
    expect(formatWonShort(9999)).toBe('9,999');
  });

  test('uses 만 for ten-thousands, one decimal, trimming .0', () => {
    expect(formatWonShort(10000)).toBe('1만');
    expect(formatWonShort(51000)).toBe('5.1만');
    expect(formatWonShort(85000)).toBe('8.5만');
    expect(formatWonShort(1234000)).toBe('123.4만');
  });

  test('uses 억 for hundred-millions', () => {
    expect(formatWonShort(100000000)).toBe('1억');
    expect(formatWonShort(120000000)).toBe('1.2억');
  });

  test('keeps the sign for negatives', () => {
    expect(formatWonShort(-45000)).toBe('-4.5만');
    expect(formatWonShort(-3000)).toBe('-3,000');
  });
});
