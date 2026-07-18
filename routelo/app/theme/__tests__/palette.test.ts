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

  test('brand + status colors', () => {
    const light: Palette = LIGHT;
    expect(light.primary).toBe('#0A84FF');
    expect(light.warning).toBe('#FF9F0A');
    // success/danger는 라이트 모드에서 흰 배경 텍스트 WCAG AA를 만족하도록 진한
    // 변형을 쓴다(contrast.test.ts가 대비를 강제). 다크 모드는 밝은 systemGreen/Red.
    expect(light.success).toBe('#207A33');
    expect(light.danger).toBe('#D70015');
    expect(DARK.success).toBe('#34C759');
    expect(DARK.danger).toBe('#FF453A');
    // brand blue is shared across themes
    expect(DARK.primary).toBe(LIGHT.primary);
  });
});
