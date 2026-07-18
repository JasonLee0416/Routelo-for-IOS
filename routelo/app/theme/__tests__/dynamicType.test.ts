import {
  clampFontMultiplier,
  effectiveFontScale,
  MAX_FONT_MULTIPLIER,
  MIN_FONT_MULTIPLIER,
} from '../dynamicType';

describe('clampFontMultiplier', () => {
  it('allows accessibility enlargement up to the max', () => {
    expect(clampFontMultiplier(1.2)).toBe(1.2);
    expect(clampFontMultiplier(MAX_FONT_MULTIPLIER)).toBe(MAX_FONT_MULTIPLIER);
    expect(clampFontMultiplier(3)).toBe(MAX_FONT_MULTIPLIER);
  });

  it('does not shrink below 1.0', () => {
    expect(clampFontMultiplier(0.5)).toBe(MIN_FONT_MULTIPLIER);
    expect(clampFontMultiplier(1)).toBe(1);
  });

  it('falls back to the safe min on non-finite input', () => {
    // 손상된 배율은 확대 없음(1.0)으로 안전하게 처리한다.
    expect(clampFontMultiplier(NaN)).toBe(MIN_FONT_MULTIPLIER);
    expect(clampFontMultiplier(Infinity)).toBe(MIN_FONT_MULTIPLIER);
    expect(clampFontMultiplier(-Infinity)).toBe(MIN_FONT_MULTIPLIER);
  });
});

describe('effectiveFontScale', () => {
  it('combines base scale with clamped OS multiplier', () => {
    expect(effectiveFontScale(1.15, 1)).toBeCloseTo(1.15, 5);
    expect(effectiveFontScale(1.15, 2)).toBeCloseTo(1.15 * MAX_FONT_MULTIPLIER, 5);
  });

  it('guards an invalid base', () => {
    expect(effectiveFontScale(0, 1.2)).toBe(1.2);
    expect(effectiveFontScale(NaN, 1)).toBe(1);
  });
});
