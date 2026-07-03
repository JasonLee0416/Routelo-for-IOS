import { withAlpha } from '../color';

describe('withAlpha', () => {
  test('converts a hex color to rgba at the given alpha', () => {
    expect(withAlpha('#0A84FF', 0.5)).toBe('rgba(10, 132, 255, 0.5)');
    expect(withAlpha('0A84FF', 0.1)).toBe('rgba(10, 132, 255, 0.1)');
    expect(withAlpha('#FFFFFF', 1)).toBe('rgba(255, 255, 255, 1)');
  });

  test('clamps alpha to [0,1]', () => {
    expect(withAlpha('#000000', 2)).toBe('rgba(0, 0, 0, 1)');
    expect(withAlpha('#000000', -1)).toBe('rgba(0, 0, 0, 0)');
  });

  test('returns non-hex input unchanged (degrades safely)', () => {
    expect(withAlpha('rgba(1,2,3,.4)', 0.5)).toBe('rgba(1,2,3,.4)');
    expect(withAlpha('tomato', 0.5)).toBe('tomato');
  });
});
