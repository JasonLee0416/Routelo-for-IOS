import { levenshtein } from '../ocr/normalize';
import { isSafe, sanitizeVendorQuery } from './sanitize';
import { VendorCandidate, VendorDirectory, VendorVerification } from './types';

const compact = (value: string) =>
  value.replace(/[\s()[\]·.,-]/g, '').toLowerCase();

const onlyDigits = (value?: string) => (value ? value.replace(/\D/g, '') : '');

// 이름 유사도 (편집거리 기반, 0..1). 기존 levenshtein 재사용.
export const nameSimilarity = (a: string, b: string): number => {
  const x = compact(a);
  const y = compact(b);
  if (!x || !y) return 0;
  const max = Math.max(x.length, y.length);
  return max === 0 ? 0 : 1 - levenshtein(x, y) / max;
};

// 전화 일치(서식 무시). 9자리 이상 + 완전 일치일 때만 true.
export const phonesMatch = (a?: string, b?: string): boolean => {
  const x = onlyDigits(a);
  const y = onlyDigits(b);
  return x.length >= 9 && x === y;
};

export type VerifyOptions = {
  ocrPhone?: string; // 인식된 "업체" 전화(선택) — PII 아님
  strong?: number; // 확인 임계치 (기본 0.82)
  weak?: number; // 모호 임계치 (기본 0.5)
  minNameLength?: number; // 너무 짧으면 스킵 (기본 2)
};

// 가드레일: 여기로 넘기는 것은 업체명(ocrName)과 선택적 업체전화(ocrPhone)뿐.
// 수령인 등 개인정보는 절대 전달하지 않는다. 값 확정은 호출자(사용자 리뷰)의 몫이며
// 이 함수는 신뢰도/후보/플래그만 돌려준다(자동 덮어쓰기 없음).
export async function verifyVendor(
  directory: VendorDirectory,
  ocrName: string,
  options: VerifyOptions = {},
): Promise<VendorVerification> {
  const strong = options.strong ?? 0.82;
  const weak = options.weak ?? 0.5;
  const minLen = options.minNameLength ?? 2;

  // 프로바이더 경계: 안전하지 않은 혼합/PII 질의는 네트워크 전에 거부한다(#51).
  const cleaned = sanitizeVendorQuery(ocrName);
  if (!isSafe(cleaned)) {
    return { ...base('skipped', ocrName.trim()), reason: `unsafe:${cleaned.rejected}` };
  }
  const query = cleaned.safe;

  if (directory.id === 'null' || compact(query).length < minLen) {
    return base('skipped', query);
  }

  let candidates: VendorCandidate[];
  try {
    candidates = await directory.search(query);
  } catch {
    return { ...base('skipped', query), reason: 'search-failed' };
  }

  if (!candidates.length) return base('notFound', query);

  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: nameSimilarity(query, candidate.name),
      phoneMatched: phonesMatch(options.ocrPhone, candidate.phone),
    }))
    .sort(
      (a, b) =>
        Number(b.phoneMatched) - Number(a.phoneMatched) || b.score - a.score,
    );

  const top = scored[0];

  // 전화 일치가 가장 강한 신호.
  const phoneWinner = scored.find((s) => s.phoneMatched);
  if (phoneWinner) {
    return {
      status: 'confirmed',
      query,
      best: phoneWinner.candidate,
      candidates,
      score: phoneWinner.score,
      phoneMatched: true,
    };
  }

  if (top.score >= strong) {
    return {
      status: 'confirmed',
      query,
      best: top.candidate,
      candidates,
      score: top.score,
      phoneMatched: false,
    };
  }

  if (top.score >= weak) {
    return {
      status: 'ambiguous',
      query,
      best: top.candidate,
      candidates,
      score: top.score,
      phoneMatched: false,
    };
  }

  return {
    status: 'notFound',
    query,
    candidates,
    score: top.score,
    phoneMatched: false,
  };
}

const base = (
  status: VendorVerification['status'],
  query: string,
): VendorVerification => ({
  status,
  query,
  candidates: [],
  score: 0,
  phoneMatched: false,
});
