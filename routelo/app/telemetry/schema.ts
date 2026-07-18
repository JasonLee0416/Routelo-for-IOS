// 품질 리포트 이벤트 스키마. 백엔드(Firestore)와 앱이 공유하는 계약.
// 개인 식별 정보는 담지 않는다(비-PII는 원문, PII는 shape 마스킹 + editDistance).

export const TELEMETRY_SCHEMA_VERSION = 1 as const;

export type TelemetryFieldCorrection = {
  key: string; // OcrFieldKey
  required: boolean;
  changed: boolean; // OCR 값과 최종 확정 값이 다른가
  editDistance: number; // 원문 기준 레벤슈타인 거리(비식별 수치)
  confidence: number;
  method?: string; // extractionMethod: label/layout/pattern/manual
  pii: boolean; // 이 필드가 PII라 값이 마스킹됐는지
  // 비-PII: 원문 그대로. PII: shape 마스킹(숫자→N, 한글→○, 영문→x).
  ocr: string;
  final: string;
};

export type TelemetryScanEvent = {
  schema: typeof TELEMETRY_SCHEMA_VERSION;
  type: 'ocr_scan_review';
  id: string; // 클라이언트 생성 이벤트 ID(중복 제거용)
  ts: number; // epoch ms
  deviceId: string; // 익명 설치 ID(랜덤 UUID)
  appVersion: string;
  engine: string;
  modelVersion?: string;
  processingMs: number;
  documentConfidence: number;
  qualityScore: number;
  qualityPassed: boolean;
  fieldCount: number;
  changedCount: number;
  corrections: TelemetryFieldCorrection[];
};

export type TelemetryEvent = TelemetryScanEvent;
