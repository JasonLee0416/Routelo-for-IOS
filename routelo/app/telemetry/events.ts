import { OcrFieldResult, OcrPipelineResult } from '../models';
import {
  TELEMETRY_SCHEMA_VERSION,
  TelemetryFieldCorrection,
  TelemetryScanEvent,
} from './schema';
import { isPiiField, levenshtein, redactValue } from './redact';

// OCR 원본 값(field.rawValue ?? 첫 추출값)과 사용자가 확정한 최종 값(field.value)을
// 비교해 필드별 교정 정보를 만든다. rawValue가 없으면 변화 없음으로 본다.
export function buildFieldCorrection(
  ocrValue: string,
  final: OcrFieldResult,
): TelemetryFieldCorrection {
  const key = final.key;
  const finalValue = final.value ?? '';
  const changed = ocrValue.trim() !== finalValue.trim();
  return {
    key,
    required: final.required,
    changed,
    editDistance: levenshtein(ocrValue.trim(), finalValue.trim()),
    confidence: final.confidence,
    method: final.extractionMethod,
    pii: isPiiField(key),
    ocr: redactValue(key, ocrValue),
    final: redactValue(key, finalValue),
  };
}

export function buildScanEvent(
  result: OcrPipelineResult,
  finalFields: OcrFieldResult[],
  meta: {
    id: string;
    ts: number;
    deviceId: string;
    appVersion: string;
  },
): TelemetryScanEvent {
  // 원본 OCR 값 조회용 맵(rawValue 우선, 없으면 최초 value로 근사).
  const originalByKey = new Map<string, string>();
  for (const f of result.fields) {
    originalByKey.set(f.key, (f.rawValue ?? f.value ?? '').toString());
  }
  const corrections = finalFields.map((f) =>
    buildFieldCorrection(originalByKey.get(f.key) ?? f.rawValue ?? '', f),
  );
  return {
    schema: TELEMETRY_SCHEMA_VERSION,
    type: 'ocr_scan_review',
    id: meta.id,
    ts: meta.ts,
    deviceId: meta.deviceId,
    appVersion: meta.appVersion,
    engine: result.engine,
    modelVersion: result.modelVersion,
    processingMs: result.processingMs,
    documentConfidence: result.documentConfidence,
    qualityScore: result.quality.score,
    qualityPassed: result.quality.passed,
    fieldCount: corrections.length,
    changedCount: corrections.filter((c) => c.changed).length,
    corrections,
  };
}
