// PR4 후속: 주소 heuristic · 업체 vs 수령자 disambiguation · 앵커-값 재랭킹.
// 라벨 매칭(normalize.ts)과 값 검증(fieldValidation.ts) 사이에서 "이 값이 어떤
// 종류인지"를 판별해, 라벨이 없거나 애매할 때 올바른 필드로 보내고 오배정을 막는다.
// 모두 순수 함수.
import { KOREAN_PHONE_PATTERN } from './fieldValidation';

// ---------- 주소 ----------
const ADDRESS_REGION =
  /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주)/;
const ADDRESS_PLACE =
  /(병원|장례식장|예식장|웨딩홀|호텔|아파트|빌딩|센터|교회|성당|타워|컨벤션|홀|회관|아울렛)/;
const ADDRESS_ADMIN =
  /([가-힣]구|[가-힣]시|[가-힣]군|[가-힣]읍|[가-힣]면|[가-힣]동|[가-힣]로|[가-힣]길|\d+\s*층|\d+\s*호|\d+\s*번지)/g;

/** 한국 주소다움을 0~1로 점수화. 지역 + 장소유형 + 행정접미사 신호를 합산. */
export function scoreAddress(text: string): number {
  let score = 0;
  if (ADDRESS_REGION.test(text)) score += 0.3;
  if (ADDRESS_PLACE.test(text)) score += 0.3;
  const admins = text.match(ADDRESS_ADMIN)?.length ?? 0;
  score += Math.min(0.5, admins * 0.2);
  return Math.min(1, score);
}

export function looksLikeAddress(text: string): boolean {
  return scoreAddress(text) >= 0.5;
}

// 배송 주소로 흔히 붙는 꼬리 라벨/노이즈(라벨 병합 잔여).
const ADDRESS_TRAILING_NOISE =
  /\s*(?:\b(?:TEL|FAX|HP)\b|T\.|전화번호|연락처|해피콜|디카사진|디카|주소|비고).*$/i;

/** 주소 값 끝에 병합된 라벨/노이즈(…201호 "TEL")를 제거한다. */
export function stripAddressNoise(value: string): string {
  return value
    .replace(ADDRESS_TRAILING_NOISE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 장소유형 앵커(끝이 N호(실)/N층). 병원·장례식장 등 뒤 부속(별관/장례식장/N호실)까지 포함.
const ADDRESS_SPAN =
  /([가-힣A-Za-z0-9]*(?:병원|장례식장|예식장|웨딩홀|호텔|컨벤션|회관|아트홀)[가-힣A-Za-z0-9\s]{0,24}?\d+\s*(?:호실|호|층))/;

/**
 * 레이아웃이 붕괴돼 주소가 blob에 뭉쳤을 때, 장소유형으로 시작해 'N호(실)/N층'으로
 * 끝나는 인접 스팬을 뽑는다(예: 거대 blob → "고대구로병원 장례식장 105호실"). 실패 시 ''.
 */
export function scanAddressSpan(text: string): string {
  const m = text.match(ADDRESS_SPAN);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

// ---------- 업체(화원/예식장) ----------
const VENDOR_MARKERS =
  /(화원|플라워|플라웨|꽃집|꽃방|꽃가게|화훼|㈜|\(주\)|주식회사|상사)/;

export function looksLikeVendor(text: string): boolean {
  return VENDOR_MARKERS.test(text);
}

/**
 * 업체(화원/예식장)명에서 전화·괄호코드·라벨 잔여를 제거해 순수 상호만 남긴다.
 * 주소로 판별되면 업체명이 아니므로 '' 반환(반대방향 disambiguation).
 */
export function cleanVendorName(raw: string): string {
  const cleaned = raw
    .replace(KOREAN_PHONE_PATTERN, ' ')
    .replace(/\b(TEL|HP|FAX|전화|연락처|팩스)\b.*$/i, ' ')
    .replace(/[|:：]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  if (looksLikeAddress(cleaned)) return '';
  if (!/[가-힣A-Za-z]/.test(cleaned)) return ''; // 숫자/기호뿐이면 상호 아님
  return cleaned;
}

// 상호가 아니라 "라벨" 자체인 …화원 단어(발주화원/배송화원 등)는 제외.
const VENDOR_LABEL_WORD =
  /^(발주화원|배송화원|수주화원|발주회원|수주회원|발주처|배송처|수주처)$/;

// 상호 토큰: ㈜/(주) 접두(선택) + 12자 이내 본문 + 상호 마커로 끝남.
const VENDOR_TOKEN =
  /((?:㈜|\(주\))?\s*[가-힣A-Za-z0-9]{1,12}(?:꽃화원|화원|플라워|플라웨|농원|화훼센터|화훼))/;

/**
 * 원시 상호 값에서 "형식 있는 상호 토큰"(00플라워/00화원…)만 뽑아 잡글자를 버린다.
 * 예: "(주)99플라워 전 화" → "(주)99플라워", "몽플라워 / FAX" → "몽플라워".
 * 마커 토큰이 없으면 cleanVendorName 결과로 폴백. 라벨어(발주화원 등)면 '' .
 */
export function extractVendorName(raw: string): string {
  const cleaned = cleanVendorName(raw);
  if (!cleaned) return '';
  const m = cleaned.match(VENDOR_TOKEN);
  if (m) {
    const token = m[1].replace(/\s+/g, '').trim();
    if (token.length >= 2 && !VENDOR_LABEL_WORD.test(token)) return token;
  }
  return VENDOR_LABEL_WORD.test(cleaned) ? '' : cleaned;
}

/**
 * 상호 마커(화원/플라워/농원…)로 끝나는 상호 토큰을 등장 순서대로 뽑는다.
 * 라벨이 값과 떨어져 병합돼도(startsWith 실패) 값 형식만으로 상호를 회복.
 * ㈜/(주) 접두는 보존. 중복 제거.
 */

export function scanVendorTokens(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re =
    /((?:㈜|\(주\))?\s*[가-힣A-Za-z0-9]{1,12}(?:꽃화원|화원|플라워|플라웨|농원))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const cleaned = cleanVendorName(m[1].replace(/\s+/g, ' ').trim());
    if (
      cleaned &&
      cleaned.length >= 2 &&
      !VENDOR_LABEL_WORD.test(cleaned) &&
      !seen.has(cleaned)
    ) {
      seen.add(cleaned);
      out.push(cleaned);
    }
  }
  return out;
}

// ---------- 사람 이름(수령자/담당자) ----------
// 역할/존칭 접두어를 반복 제거(예: "받는분 고인 심명철", "고 박희순", "상주 유기열").
const NAME_ROLE_PREFIX =
  /^(신랑|신부|상주|고인|故|고(?=\s)|받는\s*분|받는분|수령인|수령자|인수자|보내는\s*분|보내는분|담당자?|고객)\s*[:：]?\s*/;

function stripRolePrefixes(text: string): string {
  let prev = '';
  let value = text.trim();
  // 접두어가 겹쳐 붙는 경우("받는분 고인 …")를 위해 더 이상 안 줄 때까지 반복.
  while (value && value !== prev) {
    prev = value;
    value = value.replace(NAME_ROLE_PREFIX, '').trim();
  }
  return value;
}
const NAME_INSTRUCTION =
  /(반드시|이름|성명|정자|적어|전화|주세요|바랍니다|please|호실|번지)/;
const NAME_TITLE = '(실장|팀장|담당자|부장|과장|대리|사장|이사|점장|기사)';
const NAME_BODY = new RegExp(`^([가-힣]{2,4})(?:\\s*(${NAME_TITLE}))?$`);

/**
 * 값에서 사람 이름을 뽑는다. 역할 접두어(신부/상주/받는분 등)를 떼고,
 * 업체/주소/지시문/숫자를 배제한 뒤 2~4자 한글 이름(+직함)만 인정. 실패 시 ''.
 * 업체 문자열이 수령자로 잘못 배정되는 것을 막는 disambiguation 핵심.
 */
export function extractPersonName(text: string): string {
  const stripped = stripRolePrefixes(text);
  if (!stripped) return '';
  if (looksLikeVendor(stripped) || looksLikeAddress(stripped)) return '';
  if (NAME_INSTRUCTION.test(stripped)) return '';
  if (/\d/.test(stripped)) return '';
  const m = stripped.match(NAME_BODY);
  if (!m) return '';
  return m[2] ? `${m[1]} ${m[2]}` : m[1];
}

export function looksLikePersonName(text: string): boolean {
  return extractPersonName(text) !== '';
}

// 이름 뒤에 붙는 상(喪) 관계호칭(근조 인수증의 수령인 형식 신호).
const CONDOLENCE_RELATION =
  /(부친상|모친상|조부상|조모상|빙부상|빙모상|처부상|처모상|본인상|자당상|엄친상|선친상|시부상|시모상|장인상|장모상)/;

/**
 * "유기열 부친상"처럼 이름 뒤에 상(喪) 관계호칭이 붙은 근조 수령인을 값 형식으로 뽑는다.
 * 라벨('받는분')이 병합돼 사라져도 회복. 이름만 반환(관계호칭 제거). 실패 시 ''.
 */
export function scanCondolenceRecipient(text: string): string {
  const m = text.match(
    new RegExp(`([가-힣]{2,4})\\s*${CONDOLENCE_RELATION.source}`),
  );
  return m ? extractPersonName(m[1]) : '';
}

/** 값의 성격을 태그로 분류(디버깅·재랭킹 보조). */
export function classifyEntity(
  text: string,
): 'address' | 'vendor' | 'person' | 'other' {
  if (looksLikeAddress(text)) return 'address';
  if (looksLikeVendor(text)) return 'vendor';
  if (looksLikePersonName(text)) return 'person';
  return 'other';
}

// ---------- 앵커-값 재랭킹 ----------
/**
 * 여러 후보 중 scorer 점수가 가장 높은 것을 고른다(동점이면 먼저 온 것).
 * "confidence 보다 field validation/heuristic 을 더 신뢰" 원칙의 실행 도구.
 */
export function pickBest<T>(
  candidates: T[],
  scorer: (candidate: T) => number,
): T | undefined {
  let best: T | undefined;
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const score = scorer(candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return bestScore > 0 ? best : undefined;
}
