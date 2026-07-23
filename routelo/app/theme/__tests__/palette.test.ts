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

  test('brand + status colors (2026-07 재조합)', () => {
    const light: Palette = LIGHT;
    // 강조색은 모드별로 다르다: 라이트=Electric Cobalt, 다크=Spring Green.
    expect(light.primary).toBe('#0047FF');
    expect(DARK.primary).toBe('#21F1A8');
    expect(DARK.primary).not.toBe(LIGHT.primary);
    // 바탕: 라이트=Off-White, 다크=Dark Gray.
    expect(light.background).toBe('#F8F7F4');
    expect(DARK.background).toBe('#171717');
    // 버튼 글자색(onPrimary): 라이트=흰색, 다크=밝은 그린 위 진한 잉크.
    expect(light.onPrimary).toBe('#FFFFFF');
    expect(DARK.onPrimary).not.toBe('#FFFFFF');
    // success/danger는 라이트에서 흰 배경 텍스트 WCAG AA를 만족하는 진한 변형.
    expect(light.success).toBe('#207A33');
  });
});
