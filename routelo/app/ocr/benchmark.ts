import { OcrFieldKey, OcrFieldResult } from '../models';

// PR6: 필드 단위 정확도 측정 하네스(순수). 정답(ground-truth) 대비 parser 결과를
// 대조해 필드별 정오·필수필드 성공률·전체 정확도를 낸다. 회귀 가드 + 학습 루프 진입점.

export type FieldExpectation = Partial<Record<OcrFieldKey, string>>;

export type FieldMetric = {
  key: OcrFieldKey;
  expected: string;
  actual: string;
  correct: boolean;
};

export type BenchmarkMetrics = {
  fields: FieldMetric[];
  total: number;
  correct: number;
  accuracy: number; // 0~1
  requiredTotal: number;
  requiredCorrect: number;
  requiredAccuracy: number; // 0~1
  wrong: FieldMetric[];
};

const REQUIRED_KEYS: OcrFieldKey[] = [
  'deliveryDate',
  'productName',
  'deliveryAddress',
];

const normalize = (value: string) =>
  value.normalize('NFKC').replace(/\s+/g, ' ').trim();

/** 정답 픽스처와 parser 결과 필드 배열을 대조해 지표를 계산한다. */
export function computeFieldMetrics(
  expected: FieldExpectation,
  actual: OcrFieldResult[],
): BenchmarkMetrics {
  const actualByKey = new Map(actual.map((f) => [f.key, f.value]));
  const fields: FieldMetric[] = (Object.keys(expected) as OcrFieldKey[]).map(
    (key) => {
      const exp = normalize(expected[key] ?? '');
      const act = normalize(actualByKey.get(key) ?? '');
      return { key, expected: exp, actual: act, correct: exp === act };
    },
  );
  const correct = fields.filter((f) => f.correct).length;
  const required = fields.filter((f) => REQUIRED_KEYS.includes(f.key));
  const requiredCorrect = required.filter((f) => f.correct).length;
  return {
    fields,
    total: fields.length,
    correct,
    accuracy: fields.length ? correct / fields.length : 1,
    requiredTotal: required.length,
    requiredCorrect,
    requiredAccuracy: required.length ? requiredCorrect / required.length : 1,
    wrong: fields.filter((f) => !f.correct),
  };
}
