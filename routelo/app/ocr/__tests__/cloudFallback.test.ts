import {
  CLOUD_FALLBACK_CONFIDENCE_FLOOR,
  shouldRequestCloudFallback,
} from '../cloudFallback';
import { OcrFieldResult } from '../../models';

const field = (
  key: OcrFieldResult['key'],
  value: string,
  validationErrors: string[] = [],
): Pick<OcrFieldResult, 'key' | 'value' | 'validationErrors'> => ({
  key,
  value,
  validationErrors,
});

const complete = [
  field('deliveryDate', '2026-06-14'),
  field('productName', '근조3단'),
  field('deliveryAddress', '서울 강남구 선릉로 757'),
];

describe('shouldRequestCloudFallback', () => {
  test('no trigger when required fields present, confident, no conflicts', () => {
    const decision = shouldRequestCloudFallback({
      fields: complete,
      documentConfidence: 90,
      conflicts: [],
    });
    expect(decision.trigger).toBe(false);
    expect(decision.reasons).toHaveLength(0);
  });

  test('triggers on a missing required field', () => {
    const decision = shouldRequestCloudFallback({
      fields: [field('deliveryDate', ''), field('productName', '근조3단'), field('deliveryAddress', '서울 강남구')],
      documentConfidence: 90,
      conflicts: [],
    });
    expect(decision.trigger).toBe(true);
    expect(decision.reasons.some((r) => r.includes('deliveryDate'))).toBe(true);
  });

  test('triggers below the confidence floor', () => {
    const decision = shouldRequestCloudFallback({
      fields: complete,
      documentConfidence: CLOUD_FALLBACK_CONFIDENCE_FLOOR - 1,
      conflicts: [],
    });
    expect(decision.trigger).toBe(true);
    expect(decision.reasons.some((r) => r.includes('신뢰도'))).toBe(true);
  });

  test('triggers on a field validation error', () => {
    const decision = shouldRequestCloudFallback({
      fields: [...complete, field('recipientTel', '010-123-45', ['전화번호 형식이 아닙니다'])],
      documentConfidence: 90,
      conflicts: [],
    });
    expect(decision.trigger).toBe(true);
    expect(decision.reasons.some((r) => r.includes('recipientTel'))).toBe(true);
  });

  test('triggers on a time conflict', () => {
    const decision = shouldRequestCloudFallback({
      fields: complete,
      documentConfidence: 90,
      conflicts: [{ keys: ['strictTime', 'eventTime'], message: '엄수>예식' }],
    });
    expect(decision.trigger).toBe(true);
    expect(decision.reasons.some((r) => r.includes('충돌'))).toBe(true);
  });
});
