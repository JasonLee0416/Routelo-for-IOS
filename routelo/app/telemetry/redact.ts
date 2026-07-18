// PII 보호: 어떤 필드가 개인정보를 담는지 분류하고, 담는다면 정체성을 지운
// "shape"로만 남긴다. 오류 패턴(길이/구조 변화)은 보존되어 학습에는 유효하다.

// 수령인 이름·전화, 업체 전화, 주소, 자유 텍스트(메모/리본)는 제3자 개인정보를
// 담을 수 있어 마스킹한다. 상품명·수량·날짜/시간·업체명은 위험이 낮아 원문 유지.
const PII_KEYS = new Set<string>([
  'recipientName',
  'recipientTel',
  'orderingVendorTel',
  'fulfillingVendorTel',
  'deliveryAddress',
  'memo',
  'ribbonText',
]);

export function isPiiField(key: string): boolean {
  return PII_KEYS.has(key);
}

// 문자 클래스만 남기는 shape 마스킹: 숫자→N, 한글음절→○, 영문→x.
// 공백·구분자·기타 기호는 그대로 두어 구조(자릿수/토큰 경계)를 보존한다.
export function shape(value: string): string {
  let out = '';
  for (const ch of value) {
    if (ch >= '0' && ch <= '9') out += 'N';
    else if (/[A-Za-z]/.test(ch)) out += 'x';
    else if (/[가-힣]/.test(ch)) out += '○';
    else out += ch; // 공백·하이픈·콜론·괄호 등 유지
  }
  return out;
}

// 필드 정책에 따라 전송용 값으로 변환.
export function redactValue(key: string, value: string): string {
  return isPiiField(key) ? shape(value) : value;
}

// 레벤슈타인 편집거리 — OCR 오류 크기의 비식별 지표(값 자체는 담지 않는다).
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}
