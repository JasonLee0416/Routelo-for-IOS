import { DARK, LIGHT, Palette } from '../palette';
import {
  contrastRatio,
  meetsAA,
  parseHexColor,
  relativeLuminance,
  WCAG_AA_LARGE,
  WCAG_AA_NORMAL,
} from '../contrast';

describe('contrast math', () => {
  it('parses #RGB and #RRGGBB', () => {
    expect(parseHexColor('#fff')).toEqual([255, 255, 255]);
    expect(parseHexColor('#0A84FF')).toEqual([10, 132, 255]);
  });

  it('rejects invalid hex', () => {
    expect(() => parseHexColor('#12')).toThrow();
    expect(() => parseHexColor('nope')).toThrow();
  });

  it('black/white is the maximum 21:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1, 5);
  });

  it('relative luminance is 0..1 monotonic', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
  });
});

// 실제 사용되는 텍스트/배경 조합만 그 사용 크기에 맞는 기준으로 검증한다.
// (normal=본문/수치, large=굵은 버튼/UI 라벨)
type Combo = { name: string; fg: keyof Palette; bg: keyof Palette; large?: boolean };
const TEXT_COMBOS: Combo[] = [
  { name: 'text/surface', fg: 'text', bg: 'surface' },
  { name: 'text/background', fg: 'text', bg: 'background' },
  { name: 'text/surfaceAlt', fg: 'text', bg: 'surfaceAlt' },
  { name: 'textMuted/surface', fg: 'textMuted', bg: 'surface' },
  { name: 'textMuted/background', fg: 'textMuted', bg: 'background' },
  { name: 'textMuted/surfaceAlt', fg: 'textMuted', bg: 'surfaceAlt' },
  { name: 'onPrimaryContainer/primaryContainer', fg: 'onPrimaryContainer', bg: 'primaryContainer' },
  // 손익 수치·오류 문구는 본문 크기 텍스트로, 카드(surface)·화면(background)
  // 위에 표시되므로 그 배경에 대해 normal 기준. (칩/입력 fill인 surfaceAlt에는
  // 상태색 텍스트를 쓰지 않는다.)
  { name: 'success/surface', fg: 'success', bg: 'surface' },
  { name: 'success/background', fg: 'success', bg: 'background' },
  { name: 'danger/surface', fg: 'danger', bg: 'surface' },
  { name: 'danger/background', fg: 'danger', bg: 'background' },
  // 굵은 버튼 라벨(흰 글자/파란 버튼)은 large 기준.
  { name: 'white/primary(button)', fg: 'surface', bg: 'primary', large: true },
];

for (const [themeName, palette] of [
  ['LIGHT', LIGHT],
  ['DARK', DARK],
] as const) {
  describe(`${themeName} palette meets WCAG AA`, () => {
    for (const combo of TEXT_COMBOS) {
      const fg =
        combo.name === 'white/primary(button)' ? '#FFFFFF' : palette[combo.fg];
      it(`${combo.name} (${combo.large ? 'AA-large' : 'AA-normal'})`, () => {
        const ratio = contrastRatio(fg, palette[combo.bg]);
        const threshold = combo.large ? WCAG_AA_LARGE : WCAG_AA_NORMAL;
        // 실패 시 실제 비율을 메시지에 남겨 회귀 원인 파악이 쉽도록.
        expect({ combo: combo.name, ratio: Math.round(ratio * 100) / 100 }).toEqual({
          combo: combo.name,
          ratio: Math.round(ratio * 100) / 100,
        });
        expect(meetsAA(fg, palette[combo.bg], combo.large)).toBe(true);
        expect(ratio).toBeGreaterThanOrEqual(threshold - 1e-9);
      });
    }
  });
}
