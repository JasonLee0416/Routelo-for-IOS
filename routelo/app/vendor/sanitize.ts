// 프로바이더 경계 새니타이저 (이슈 #51 PR1).
// 네트워크로 나가기 전에 "업체명만" 남기고, 개인정보(PII)나 혼합 OCR 라인은 거부한다.
// - 전화번호 형태 포함 → 거부 (수령인/혼합 위험)
// - 주소 형태(로/길+번지, 동/읍/면, 호/층/번지) 포함 → 거부
// - 너무 길거나 토큰이 많음(혼합 라인) → 거부
// 통과한 경우에만 정제된 업체명 질의를 돌려준다.

export type SanitizeResult = { safe: string } | { rejected: string };

const PHONE_RE = /\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{4}/;
const ADDRESS_RE =
  /[가-힣]+(?:로|길)\s*\d|\d+\s*(?:번지|층|호)|[가-힣]{2,}(?:읍|면|동)\s/;

export function sanitizeVendorQuery(raw: string): SanitizeResult {
  const q = (raw || '').trim().replace(/\s+/g, ' ');
  if (!q) return { rejected: 'empty' };
  if (q.length > 40) return { rejected: 'too-long' };
  if (PHONE_RE.test(q)) return { rejected: 'phone-like' };
  if (ADDRESS_RE.test(q)) return { rejected: 'address-like' };
  if (q.split(' ').length > 5) return { rejected: 'too-many-tokens' };
  return { safe: q };
}

export const isSafe = (
  result: SanitizeResult,
): result is { safe: string } => 'safe' in result;
