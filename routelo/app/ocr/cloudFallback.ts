import { OcrFieldKey, OcrFieldResult } from '../models';
import { FieldConflict } from './fieldValidation';

// PR5(부분): CLOVA 2차 보정을 "언제 제안할지" 결정하는 순수 로직.
// 인수증엔 개인정보가 있어 자동 전송 금지 — 이 함수는 제안(trigger)만 만든다.
// 실제 호출은 사용자 동의(consent) 후 별도 어댑터가 수행한다.

// 이 세 필드가 비면 인수증으로서 사실상 무의미 → 보정 우선순위 최상.
const REQUIRED_KEYS: OcrFieldKey[] = [
  'deliveryDate',
  'productName',
  'deliveryAddress',
];

// 문서 신뢰도가 이 값 미만이면 재인식 후보.
export const CLOUD_FALLBACK_CONFIDENCE_FLOOR = 82;

export type CloudFallbackInput = {
  fields: Array<
    Pick<OcrFieldResult, 'key' | 'value' | 'validationErrors'>
  >;
  documentConfidence: number;
  conflicts: FieldConflict[];
};

export type CloudFallbackDecision = {
  trigger: boolean;
  reasons: string[];
};

export function shouldRequestCloudFallback(
  input: CloudFallbackInput,
): CloudFallbackDecision {
  const reasons: string[] = [];
  const byKey = new Map(input.fields.map((f) => [f.key, f]));

  for (const key of REQUIRED_KEYS) {
    const field = byKey.get(key);
    if (!field || !field.value) reasons.push(`필수 필드 누락: ${key}`);
  }

  if (input.documentConfidence < CLOUD_FALLBACK_CONFIDENCE_FLOOR) {
    reasons.push(`문서 신뢰도 낮음 (${input.documentConfidence})`);
  }

  for (const field of input.fields) {
    if (field.value && (field.validationErrors?.length ?? 0) > 0) {
      reasons.push(`검증 실패: ${field.key}`);
    }
  }

  for (const conflict of input.conflicts) {
    reasons.push(`충돌: ${conflict.message}`);
  }

  return { trigger: reasons.length > 0, reasons };
}
