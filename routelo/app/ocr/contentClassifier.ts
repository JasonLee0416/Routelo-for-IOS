// Phase 1 (값-형식 분류) — 시작점: 경조사 종류(eventType) 형식 추론.
// 값들의 형식/키워드로 행사 종류를 판정해, 상품명/리본 교차검증과 필드 분류의 근거로 쓴다.
// 라벨 위치에 의존하지 않으므로 레이아웃이 깨져도 동작한다. 순수 함수.

export type EventType = '축하' | '근조' | '개업' | '기타';

// 각 종류의 신호 키워드(장소유형·경조사어·상품·역할). 도메인 일반 규칙만 사용(특정 값 하드코딩 금지).
const SIGNALS: Record<Exclude<EventType, '기타'>, RegExp> = {
  축하: /웨딩|예식|본식|축화혼|축결혼|결혼|약혼|축하화환|화혼|신랑|신부|축\s*결|그랜드볼룸|컨벤션/g,
  근조: /장례|장례식장|조의|근조|삼가|부고|빈소|故|고인|상주|영결|추모|병원.*(장례|영안)|발인/g,
  개업: /개업|축개업|개원|개장|이전|창립|준공|취임|영전/g,
};

/**
 * 인수증 전체 텍스트에서 경조사 종류를 추론한다. 신호 개수 argmax.
 * confidence = (1등 표수) / (전체 표수) — 신호 상충 시 낮게 나와 검수로 유도.
 */
export function inferEventType(text: string): {
  type: EventType;
  confidence: number;
  votes: Record<Exclude<EventType, '기타'>, number>;
} {
  const votes = { 축하: 0, 근조: 0, 개업: 0 } as Record<
    Exclude<EventType, '기타'>,
    number
  >;
  (Object.keys(SIGNALS) as Array<Exclude<EventType, '기타'>>).forEach((k) => {
    votes[k] = (text.match(SIGNALS[k]) || []).length;
  });
  const total = votes.축하 + votes.근조 + votes.개업;
  if (total === 0) return { type: '기타', confidence: 0, votes };
  const winner = (Object.keys(votes) as Array<Exclude<EventType, '기타'>>).reduce(
    (best, k) => (votes[k] > votes[best] ? k : best),
    '축하' as Exclude<EventType, '기타'>,
  );
  return { type: winner, confidence: votes[winner] / total, votes };
}

/** 경조사 종류에 맞는 상품 계열(축하화환/근조화환)을 돌려준다. 상품명 보정/검증용. */
export function expectedProductCategory(type: EventType): string | null {
  if (type === '축하') return '축하화환';
  if (type === '근조') return '근조화환';
  if (type === '개업') return '개업화환';
  return null;
}
