// LUCENT color palette.
//
// 브랜드 축(2026-07 재조합):
//   라이트 = Electric Cobalt(#0047FF) 강조 + Off-White(#F8F7F4) 바탕
//   다크   = Medium Spring Green(#21F1A8) 강조 + Dark Gray(#171717) 바탕
// 강조색은 "튀지 않게" 주요 조작(버튼·활성·핵심 수치)에만 쓰고, 바탕/보조는
// 각 축에서 파생한 저채도 톤으로 통일한다. 두 모드의 잉크/바탕(#171717 ↔ #F5F4F1)을
// 서로 반사시켜 라이트-다크가 한 세트로 읽히게 한다.
//
// 밝은 스프링 그린 위에는 흰 글자 대비가 안 나오므로, 버튼 글자색은 `onPrimary`
// 토큰으로 분리한다(라이트=흰색, 다크=진한 그린 잉크). 모든 조합은 WCAG AA를
// 만족하며 `__tests__/contrast.test.ts`가 이를 강제한다.

export type Palette = {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  navy: string;
  emphasis: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  outline: string;
  text: string;
  textMuted: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  danger: string;
  dangerBg: string;
};

export const LIGHT: Palette = {
  primary: '#0047FF', // Electric Cobalt
  onPrimary: '#FFFFFF',
  primaryContainer: '#E1E8FF',
  onPrimaryContainer: '#002B99',
  navy: '#171717',
  emphasis: '#171717',
  background: '#F8F7F4', // Off-White
  surface: '#FFFFFF',
  surfaceAlt: '#EFEEE9',
  outline: '#E3E1DA',
  text: '#171717',
  textMuted: '#6E6B64',
  success: '#207A33',
  successBg: '#E6F2E9',
  warning: '#B26A00',
  warningBg: '#F6ECD9',
  danger: '#C7261D',
  dangerBg: '#F7E4E1',
};

export const DARK: Palette = {
  primary: '#21F1A8', // Medium Spring Green
  onPrimary: '#05231A', // 밝은 그린 위 진한 잉크
  primaryContainer: '#0E2C22',
  onPrimaryContainer: '#8CF3D0',
  navy: '#F5F4F1',
  emphasis: '#292928',
  background: '#171717', // Dark Gray
  surface: '#1F1F1E',
  surfaceAlt: '#292928',
  outline: '#3A3A38',
  text: '#F5F4F1',
  textMuted: '#A6A39C',
  success: '#34C759',
  successBg: '#123322',
  warning: '#FFC24D',
  warningBg: '#33280F',
  danger: '#FF5A4F',
  dangerBg: '#33191A',
};
