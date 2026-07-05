import {
  expectedProductCategory,
  inferEventType,
} from '../contentClassifier';

describe('inferEventType', () => {
  test('classifies a wedding receipt', () => {
    const e = inferEventType('배달장소 해군호텔 W웨딩홀 리본 축화혼 신부 축하화환 3단');
    expect(e.type).toBe('축하');
    expect(e.confidence).toBe(1);
  });

  test('classifies a funeral receipt', () => {
    const e = inferEventType('중앙대병원 장례식장 5호 근조 삼가 조의 받는분 고 박희순');
    expect(e.type).toBe('근조');
  });

  test('classifies an opening receipt', () => {
    expect(inferEventType('축개업 개업화환 이전').type).toBe('개업');
  });

  test('returns 기타 with 0 confidence when no signal', () => {
    const e = inferEventType('상품명 수량 배달장소 전화');
    expect(e.type).toBe('기타');
    expect(e.confidence).toBe(0);
  });

  test('confidence drops when signals conflict (routes to review)', () => {
    const e = inferEventType('웨딩홀 축화혼 장례식장 근조'); // 2 vs 2
    expect(e.confidence).toBeLessThan(1);
  });
});

describe('expectedProductCategory', () => {
  test('maps event type to product family', () => {
    expect(expectedProductCategory('축하')).toBe('축하화환');
    expect(expectedProductCategory('근조')).toBe('근조화환');
    expect(expectedProductCategory('기타')).toBeNull();
  });
});
