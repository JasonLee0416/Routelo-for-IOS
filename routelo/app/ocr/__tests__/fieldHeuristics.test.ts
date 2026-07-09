import {
  classifyEntity,
  cleanVendorName,
  extractPersonName,
  looksLikeAddress,
  looksLikeVendor,
  pickBest,
  scanCondolenceRecipient,
  scanVendorTokens,
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

  test('strips stacked role/honorific prefixes (고/고인/상주 …)', () => {
    expect(extractPersonName('고 박희순')).toBe('박희순');
    expect(extractPersonName('고인 심명철')).toBe('심명철');
    expect(extractPersonName('받는분 고인 구본순')).toBe('구본순');
    expect(extractPersonName('상주 유기열')).toBe('유기열');
    expect(extractPersonName('받는분 : 고인 김기회')).toBe('김기회');
  });

  test('rejects vendors, addresses, instructions, and digit-bearing values', () => {
    expect(extractPersonName('선유꽃화원')).toBe('');
    expect(extractPersonName('서울 강남구 선릉로 757')).toBe('');
    expect(extractPersonName('반드시 이름으로 적어주세요')).toBe('');
    expect(extractPersonName('010-4821-7732')).toBe('');
  });
});

describe('cleanVendorName', () => {
  test('strips phone and label residue from a shop name', () => {
    expect(cleanVendorName('㈜99플라워 070-4741-0001')).toBe('㈜99플라워');
    expect(cleanVendorName('선유꽃화원 TEL 070-4741-0001')).toBe('선유꽃화원');
    expect(cleanVendorName('마음꽃화원')).toBe('마음꽃화원');
  });
  test('keeps vendor names without an explicit marker', () => {
    expect(cleanVendorName('아뜰리에몽쁠라워')).toBe('아뜰리에몽쁠라워');
  });
  test('rejects an address or digits-only value as a vendor name', () => {
    expect(cleanVendorName('서울 강남구 선릉로 757 3층')).toBe('');
    expect(cleanVendorName('070-4741-0001')).toBe('');
  });
});

describe('scanVendorTokens', () => {
  test('recovers shop names by marker, in order, excluding label words', () => {
    // 라벨(발주화원/배송화원)이 값과 떨어져 병합돼도 상호를 회복
    expect(
      scanVendorTokens('발주화원 배송화원 상품명 (주)99플라워 전화 선유꽃화원'),
    ).toEqual(['(주)99플라워', '선유꽃화원']);
  });
  test('extracts a parenthetical shop from a combined line', () => {
    expect(
      scanVendorTokens('경기 의정부시 경기의정21호(타임플라워)-010-5898-9543'),
    ).toEqual(['타임플라워']);
  });
  test('dedupes and skips pure label words', () => {
    expect(scanVendorTokens('발주화원 배송화원 수주화원')).toEqual([]);
  });
});

describe('scanCondolenceRecipient', () => {
  test('이름 + 상(喪) 관계호칭에서 이름만 회복', () => {
    expect(scanCondolenceRecipient('유기열 부친상')).toBe('유기열');
    expect(scanCondolenceRecipient('...보내는분 김철수 모친상 삼가')).toBe('김철수');
  });
  test('관계호칭이 없으면 빈 문자열', () => {
    expect(scanCondolenceRecipient('보내는분 강서구청 동기생 일동')).toBe('');
  });
  test('업체/지시문은 이름으로 오인하지 않음', () => {
    expect(scanCondolenceRecipient('선유꽃화원 부친상')).toBe('');
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
