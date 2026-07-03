import { concentricRadius, GLASS, GLASS_ROLE, RADIUS } from '../tokens';

describe('RADIUS tokens', () => {
  test('semantic radii match the LUCENT spec', () => {
    expect(RADIUS.smallButton).toBe(12);
    expect(RADIUS.button).toBe(16);
    expect(RADIUS.card).toBe(24);
    expect(RADIUS.bottomSheet).toBe(32);
    expect(RADIUS.floatingNav).toBe(36);
    expect(RADIUS.fab).toBe(999);
  });

  test('concentric rule: childRadius = parentRadius - padding (clamped at 0)', () => {
    expect(concentricRadius(RADIUS.floatingNav, 8)).toBe(28); // nav 36 - 8
    expect(concentricRadius(RADIUS.bottomSheet, 18)).toBe(14); // sheet 32 - 18
    expect(concentricRadius(10, 20)).toBe(0);
  });
});

describe('GLASS strength tokens', () => {
  test('regular is the default tier with the spec values', () => {
    expect(GLASS.regular).toEqual({
      blur: 20,
      bgOpacity: 0.58,
      tintOpacity: 0.1,
      strokeOpacity: 0.22,
      shadowOpacity: 0.16,
      highlightOpacity: 0.16,
    });
  });

  test('blur increases from subtle → clear', () => {
    expect(GLASS.subtle.blur).toBeLessThan(GLASS.regular.blur);
    expect(GLASS.regular.blur).toBeLessThan(GLASS.prominent.blur);
    expect(GLASS.prominent.blur).toBeLessThan(GLASS.clear.blur);
  });

  test('control layers map to the intended strengths', () => {
    expect(GLASS_ROLE.bottomNav).toBe('prominent');
    expect(GLASS_ROLE.fab).toBe('prominent');
    expect(GLASS_ROLE.toolbar).toBe('regular');
    expect(GLASS_ROLE.search).toBe('subtle');
    expect(GLASS_ROLE.contentCard).toBe('none');
  });
});
