// LUCENT color palette — mirrors iOS system colors (systemBlue/Red/Orange/
// Green, label, separator, grouped backgrounds). Extracted from the screen
// monolith so the theme layer is importable on its own; the Palette keys are
// unchanged, so every existing usage keeps working.

export type Palette = {
  primary: string;
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
  primary: '#0A84FF',
  primaryContainer: '#D8E9FF',
  onPrimaryContainer: '#0A3A80',
  navy: '#1C1C1E',
  emphasis: '#1C1C1E',
  background: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EDEFF4',
  outline: '#D8DADF',
  text: '#1C1C1E',
  textMuted: '#6B6B70',
  // 라이트 모드에서 밝은 systemGreen/Red는 흰 배경 텍스트 대비가 WCAG AA에
  // 미달(2.2/3.4)해, 텍스트로 쓰이는 손익 수치·오류 문구가 야외(햇빛)에서 잘 안
  // 보인다. AA(4.5) 이상을 만족하는 진한 변형으로 교체(대비 자동검증 테스트로 고정).
  success: '#207A33',
  successBg: '#E3F8EA',
  warning: '#FF9F0A',
  warningBg: '#FFF1DD',
  danger: '#D70015',
  dangerBg: '#FFE5E3',
};

export const DARK: Palette = {
  primary: '#0A84FF',
  primaryContainer: '#10233F',
  onPrimaryContainer: '#CFE4FF',
  navy: '#F5F5F7',
  emphasis: '#2C2C2E',
  background: '#000000',
  surface: '#1C1C1E',
  surfaceAlt: '#2C2C2E',
  outline: '#48484A',
  text: '#F5F5F7',
  textMuted: '#AEAEB2',
  success: '#34C759',
  successBg: '#11331D',
  warning: '#FF9F0A',
  warningBg: '#3A2A12',
  danger: '#FF453A',
  dangerBg: '#3A1C1A',
};
