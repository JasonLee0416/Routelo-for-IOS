import {
  classifyEntity,
  extractPersonName,
  looksLikeAddress,
  looksLikeVendor,
  pickBest,
  scoreAddress,
} from '../fieldHeuristics';
import { pickTypedValue } from '../fieldValidation';

describe('address heuristic', () => {
  test('recognizes real receipt delivery addresses', () => {
    expect(looksLikeAddress('서울 영등포구 공군호텔 그랜드볼룸 3층')).toBe(true);
    expect(looksLikeAddress('영등포구 가마산로 538 해군호텔 W웨딩홀')).toBe(true);
    expect(looksLikeAddress('고려대구로병원 장례식장 105호실')).toBe(true);
    expect(looksLikeAddress('서울 강남구 선릉로 757 더채플앳청담 3층')).toBe(true);
  });

  test('does not treat vendors / names / ribbons as addresses', () => {
    expect(looksLikeAddress('㈜99플라워')).toBe(false);
    expect(looksLikeAddress('김유겸')).toBe(false);
    expect(looksLikeAddress('결혼을 축하드립니다')).toBe(false);
  });

  test('scores richer addresses higher', () => {
    expect(scoreAddress('서울 강남구 선릉로 757 3층')).toBeGreaterThan(
      scoreAddress('강남구'),
    );
  });
});

describe('vendor detection', () => {
  test('flags flower shops and corporate markers', () => {
    ['한국직거래화훼센터', '㈜99플라워', '선유꽃화원', '(주)99플라워'].forEach(
      (v) => expect(looksLikeVendor(v)).toBe(true),
    );
  });
  test('a plain person name is not a vendor', () => {
    expect(looksLikeVendor('박희순')).toBe(false);
  });
});

describe('extractPersonName (vendor vs recipient disambiguation)', () => {
  test('strips role prefixes and keeps the name', () => {
    expect(extractPersonName('신부 선단비')).toBe('선단비');
    expect(extractPersonName('상주 유기열')).toBe('유기열');
    expect(extractPersonName('받는 분 김민준')).toBe('김민준');
    expect(extractPersonName('김민준')).toBe('김민준');
  });

  test('preserves a trailing title', () => {
    expect(extractPersonName('김민준 실장')).toBe('김민준 실장');
  });

  test('rejects vendors, addresses, instructions, and digit-bearing values', () => {
    expect(extractPersonName('선유꽃화원')).toBe('');
    expect(extractPersonName('서울 강남구 선릉로 757')).toBe('');
    expect(extractPersonName('반드시 이름으로 적어주세요')).toBe('');
    expect(extractPersonName('010-4821-7732')).toBe('');
  });
});

describe('classifyEntity', () => {
  test('routes each value to its kind', () => {
    expect(classifyEntity('서울 강남구 선릉로 757 3층')).toBe('address');
    expect(classifyEntity('선유꽃화원')).toBe('vendor');
    expect(classifyEntity('김민준')).toBe('person');
    expect(classifyEntity('!!??')).toBe('other');
  });
});

describe('anchor-value re-ranking', () => {
  test('pickBest returns the highest-scoring candidate', () => {
    const lines = ['수량 1', '서울 강남구 선릉로 757 3층', '결혼 축하'];
    expect(pickBest(lines, scoreAddress)).toBe('서울 강남구 선릉로 757 3층');
  });

  test('pickBest returns undefined when nothing scores', () => {
    expect(pickBest(['abc', 'def'], scoreAddress)).toBeUndefined();
  });

  test('pickTypedValue prefers the value that validates for the type', () => {
    expect(pickTypedValue('tel', ['수령인', '010-123-45', '010-4821-7732'])).toBe(
      '010-4821-7732',
    );
    expect(pickTypedValue('datetime', ['참고', '2026년 06월 14일'])).toBe('2026-06-14');
  });
});
