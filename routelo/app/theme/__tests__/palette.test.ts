import { DARK, LIGHT, Palette } from '../palette';

describe('LUCENT palette', () => {
  test('LIGHT and DARK expose the exact same keys', () => {
    expect(Object.keys(LIGHT).sort()).toEqual(Object.keys(DARK).sort());
  });

  test('every value is a hex color string', () => {
    for (const palette of [LIGHT, DARK]) {
      for (const value of Object.values(palette)) {
        expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  test('brand + status colors match the iOS system palette', () => {
    const light: Palette = LIGHT;
    expect(light.primary).toBe('#0A84FF');
    expect(light.danger).toBe('#FF453A');
    expect(light.warning).toBe('#FF9F0A');
    expect(light.success).toBe('#34C759');
    // brand blue is shared across themes
    expect(DARK.primary).toBe(LIGHT.primary);
  });
});
