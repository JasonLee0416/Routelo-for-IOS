// WCAG 2.1 명암비 검사(순수 함수). 팔레트의 텍스트/배경 조합이 접근성 대비
// 기준(AA)을 지키는지 테스트로 고정하기 위한 유틸이다. 색 회귀가 나면 유닛
// 테스트가 잡아낸다. (사용성 로드맵: 대비 자동검증)

export const WCAG_AA_NORMAL = 4.5; // 일반 텍스트
export const WCAG_AA_LARGE = 3.0; // 큰 텍스트(≥18pt, 또는 ≥14pt 굵게) · UI 요소

// '#RGB' / '#RRGGBB'를 [r,g,b] 0..255로. 잘못된 값은 예외.
export function parseHexColor(hex: string): [number, number, number] {
  const cleaned = hex.trim().replace(/^#/, '');
  const full =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`invalid hex color: ${hex}`);
  }
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

// sRGB → 상대 휘도(WCAG 정의).
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHexColor(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// 두 색의 명암비 1..21.
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsAA(
  fg: string,
  bg: string,
  large = false,
): boolean {
  return (
    contrastRatio(fg, bg) >= (large ? WCAG_AA_LARGE : WCAG_AA_NORMAL) - 1e-9
  );
}
