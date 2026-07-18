export type TelemetryConfig = {
  projectId: string;
  apiKey: string;
  collection: string;
};

// Firebase 웹 API 키는 "비밀"이 아니다 — 프로젝트를 식별할 뿐이고, 실제 접근 권한은
// Firestore 보안 규칙으로 통제한다(TELEMETRY_SETUP.md 참고). 따라서 아래 두 값을
// 본인 Firebase 프로젝트 값으로 채워 커밋해도 안전하다. 비어 있으면 수집은 비활성.
export const TELEMETRY_CONFIG: TelemetryConfig = {
  projectId: '',
  apiKey: '',
  collection: 'ocr_reports',
};

export function isTelemetryConfigured(
  config: TelemetryConfig = TELEMETRY_CONFIG,
): boolean {
  return Boolean(config.projectId && config.apiKey);
}
