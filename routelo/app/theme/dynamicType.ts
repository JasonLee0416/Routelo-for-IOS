// Dynamic Type 지원 정책(순수 함수). 앱은 이미 FONT_SCALE(1.15)로 기본 가독성을
// 한 단계 올려두고, 그 위에 iOS 손쉬운 사용(글자 크기) 설정이 얹힌다. 고정 높이
// 행·칩이 많은 화면 특성상 무제한 확대는 레이아웃을 깨뜨리므로, OS 배율을 접근성
// 확대는 허용하되 안전 상한으로 클램프한다(Apple HIG: Dynamic Type 지원, 단
// 레이아웃 붕괴 방지). 실제 적용은 Text/TextInput의 maxFontSizeMultiplier로 한다.

// 기본 1.15배 위에 OS 확대를 이 배율까지 허용(총 최대 ≈1.15×1.3 ≈ 1.5배).
export const MAX_FONT_MULTIPLIER = 1.3;

// 하한은 1.0(축소는 허용하지 않음: 너무 작아지는 것 방지).
export const MIN_FONT_MULTIPLIER = 1.0;

export function clampFontMultiplier(multiplier: number): number {
  if (!Number.isFinite(multiplier)) return MIN_FONT_MULTIPLIER;
  return Math.min(
    MAX_FONT_MULTIPLIER,
    Math.max(MIN_FONT_MULTIPLIER, multiplier),
  );
}

// 정적 기본 스케일(base)과 OS 배율(os)을 합친 유효 배율. os는 상한으로 클램프.
export function effectiveFontScale(base: number, osMultiplier: number): number {
  const safeBase = Number.isFinite(base) && base > 0 ? base : 1;
  return safeBase * clampFontMultiplier(osMultiplier);
}
