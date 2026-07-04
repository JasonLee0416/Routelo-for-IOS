import { FieldType } from './fieldRegistry';
import { ReceiptFieldKey } from './schema';

// PR4 도메인 값 검증/정규화 계층.
// 라벨→필드 매핑(normalize.ts) 이후, 값 자체를 도메인 규칙으로 검증·정규화한다.
// 원칙: "OCR confidence 보다 field validation 을 더 신뢰한다" — 규칙에 안 맞는 값은
// 신뢰도가 높아도 무효로 본다. 모두 순수 함수 (추론/네이티브 의존 없음).

// ---------- 전화번호 ----------
// 화훼 배송 인수증은 070(VoIP)·1566 같은 대표번호가 지배적이라 기존 02/01x/지역번호에
// 070 과 15xx/16xx/18xx 대표번호를 반드시 포함해야 한다.
export const KOREAN_PHONE_PATTERN =
  /(?<!\d)(?:01[016789][-\s]?\d{3,4}[-\s]?\d{4}|070[-\s]?\d{4}[-\s]?\d{4}|02[-\s]?\d{3,4}[-\s]?\d{4}|0[3-6][0-9][-\s]?\d{3,4}[-\s]?\d{4}|1[0-9]{3}[-\s]?\d{4})(?!\d)/g;

export function normalizeKoreanPhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  // 대표번호 1566-0028 등 (8자리, 1로 시작)
  if (/^1[0-9]{3}$/.test(d.slice(0, 4)) && d.length === 8) {
    return `${d.slice(0, 4)}-${d.slice(4)}`;
  }
  // 휴대폰 01x
  if (/^01[016789]/.test(d)) {
    if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    return '';
  }
  // VoIP 070
  if (/^070/.test(d) && d.length === 11) {
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  }
  // 서울 02
  if (/^02/.test(d) && (d.length === 9 || d.length === 10)) {
    return `${d.slice(0, 2)}-${d.slice(2, -4)}-${d.slice(-4)}`;
  }
  // 지역번호 03x~06x
  if (/^0[3-6][0-9]/.test(d) && (d.length === 10 || d.length === 11)) {
    return `${d.slice(0, 3)}-${d.slice(3, -4)}-${d.slice(-4)}`;
  }
  return '';
}

export function isValidKoreanPhone(value: string): boolean {
  return normalizeKoreanPhone(value) !== '';
}

// ---------- 날짜 ----------
function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * 인수증 날짜를 `YYYY-MM-DD`로 정규화.
 * 지원: `2026년 06월 14일`, `2026.06.14`, `2026-6-14`, `2026/06/14`, 그리고
 * 연도 없는 `06월 14일` (defaultYear 제공 시). 실제 달력 날짜만 통과.
 */
/**
 * 날짜를 정규화하면서 **원본에서 매칭된 실제 문자열**(raw)도 함께 돌려준다.
 * 재포맷된 값의 provenance(원본 추적)를 잃지 않도록 sourceText로 쓰기 위함.
 */
export function matchKoreanDate(
  text: string,
  defaultYear?: number,
): { value: string; raw: string } | null {
  const full = text.match(
    /(20\d{2})\s*[년.\-/]\s*(\d{1,2})\s*[월.\-/]\s*(\d{1,2})/,
  );
  if (full) {
    const [year, month, day] = [Number(full[1]), Number(full[2]), Number(full[3])];
    if (isRealDate(year, month, day)) {
      return { value: `${year}-${pad2(month)}-${pad2(day)}`, raw: full[0] };
    }
  }
  const monthDay = text.match(/(?<!\d)(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (monthDay && defaultYear) {
    const [month, day] = [Number(monthDay[1]), Number(monthDay[2])];
    if (isRealDate(defaultYear, month, day)) {
      return { value: `${defaultYear}-${pad2(month)}-${pad2(day)}`, raw: monthDay[0] };
    }
  }
  return null;
}

export function normalizeKoreanDate(text: string, defaultYear?: number): string {
  return matchKoreanDate(text, defaultYear)?.value ?? '';
}

// ---------- 시간 ----------
/**
 * 시각을 24h `HH:MM`으로 정규화.
 * 지원: `17:00`, `17시 00분`, `12시20분`, `오후 5시`, `오전 12시`. 00:00~23:59만 통과.
 */
export function normalizeKoreanTime(text: string): string {
  const compact = text.replace(/\s/g, '');
  const colon = compact.match(/(\d{1,2}):(\d{2})/);
  if (colon) {
    const hour = Number(colon[1]);
    const minute = Number(colon[2]);
    if (hour <= 23 && minute <= 59) return `${pad2(hour)}:${colon[2]}`;
    return '';
  }
  const korean = compact.match(/(오전|오후)?(\d{1,2})시(?:(\d{1,2})분?)?/);
  if (!korean) return '';
  let hour = Number(korean[2]);
  const minute = Number(korean[3] || 0);
  if (hour > 23 || minute > 59) return '';
  if (korean[1] === '오후' && hour < 12) hour += 12;
  if (korean[1] === '오전' && hour === 12) hour = 0;
  return `${pad2(hour)}:${pad2(minute)}`;
}

/** `11:00~12:30`, `11:00 - 12시` 같은 범위에서 시작/종료 시각을 뽑는다. */
export function parseTimeRange(
  text: string,
): { start: string; end: string } | null {
  const m = text.match(
    /(\d{1,2}:\d{2})\s*[~～\-]\s*(\d{1,2})\s*:?\s*(\d{2})?/,
  );
  if (!m) return null;
  const start = normalizeKoreanTime(m[1]);
  const end = normalizeKoreanTime(m[3] ? `${m[2]}:${m[3]}` : `${m[2]}시`);
  if (!start || !end) return null;
  return { start, end };
}

// ---------- 수량 ----------
export function normalizeQuantity(text: string): string {
  // (?!\d)/(?<!\d) 가드로 "100" 에서 "10"을 잘라오는 오추출을 막는다.
  const explicit = text.match(/수량\s*[|:]?\s*(\d{1,2})(?!\d)/);
  const count = explicit || text.match(/(?<!\d)(\d{1,2})\s*개/);
  const quantity = count ? Number(count[1]) : NaN;
  return Number.isInteger(quantity) && quantity > 0 && quantity <= 99
    ? String(quantity)
    : '';
}

// ---------- 타입별 디스패처 ----------
export type FieldValidation = {
  value: string; // 정규화된 값 (실패 시 '')
  valid: boolean;
  errors: string[];
};

export function validateFieldValue(
  type: FieldType,
  raw: string,
  options: { defaultYear?: number } = {},
): FieldValidation {
  const trimmed = raw.trim();
  if (!trimmed) return { value: '', valid: false, errors: ['빈 값'] };

  switch (type) {
    case 'tel': {
      const value = normalizeKoreanPhone(trimmed);
      return value
        ? { value, valid: true, errors: [] }
        : { value: '', valid: false, errors: ['전화번호 형식이 아닙니다'] };
    }
    case 'datetime': {
      const value = normalizeKoreanDate(trimmed, options.defaultYear);
      return value
        ? { value, valid: true, errors: [] }
        : { value: '', valid: false, errors: ['날짜를 해석할 수 없습니다'] };
    }
    case 'time': {
      const value = normalizeKoreanTime(trimmed);
      return value
        ? { value, valid: true, errors: [] }
        : { value: '', valid: false, errors: ['시각 형식이 아닙니다'] };
    }
    case 'number': {
      const value = normalizeQuantity(trimmed);
      return value
        ? { value, valid: true, errors: [] }
        : { value: '', valid: false, errors: ['1~99 수량이 아닙니다'] };
    }
    case 'text':
    default:
      return { value: trimmed, valid: true, errors: [] };
  }
}

/**
 * 값이 특정 타입에 얼마나 부합하는지 0~1 점수. 필드 인지 재랭킹용
 * (동일 필드 후보가 여럿일 때 confidence 대신/보완하여 선택).
 */
export function scoreValueForType(type: FieldType, raw: string): number {
  const v = validateFieldValue(type, raw);
  if (type === 'text') return raw.trim() ? 0.5 : 0;
  return v.valid ? 1 : 0;
}

// ---------- 교차 필드 충돌 검사 ----------
export type FieldConflict = { keys: ReceiptFieldKey[]; message: string };

/** 시간 필드 간 논리적 모순을 검출해 검수 UI에서 강조하게 한다. */
export function detectFieldConflicts(
  fields: Partial<Record<ReceiptFieldKey, string>>,
): FieldConflict[] {
  const conflicts: FieldConflict[] = [];
  const start = fields.deliveryWindowStart;
  const end = fields.deliveryWindowEnd;
  if (start && end && start > end) {
    conflicts.push({
      keys: ['deliveryWindowStart', 'deliveryWindowEnd'],
      message: `배송 시간대가 뒤집혀 있습니다 (${start} ~ ${end})`,
    });
  }
  const strict = fields.strictTime;
  const event = fields.eventTime;
  if (strict && event && strict > event) {
    conflicts.push({
      keys: ['strictTime', 'eventTime'],
      message: `엄수 시간(${strict})이 예식 시간(${event})보다 늦습니다`,
    });
  }
  return conflicts;
}
