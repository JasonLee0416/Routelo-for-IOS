// Firestore REST 클라이언트(회원 자격). 네이티브 SDK 없이 fetch만 사용.
// 문서 키 = 익명 설치 ID. 읽기(fetchMember)와 자기등록(registerMember)만 한다.
// plan 변경(승격/강등)은 앱이 아니라 운영자가 콘솔/규칙으로 한다.
import { MembershipConfig } from './config';
import { FetchResult, MemberPlan, MemberRecord } from './schema';

type FsValue = Record<string, unknown>;

function toValue(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number')
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  return { stringValue: String(v) };
}

function toFields(obj: Record<string, unknown>): Record<string, FsValue> {
  const out: Record<string, FsValue> = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] === undefined) continue;
    out[key] = toValue(obj[key]);
  }
  return out;
}

// Firestore 값 → 원시값(우리가 읽는 문자열/숫자/불리언만). 그 외는 undefined.
export function fromValue(value: FsValue | undefined): unknown {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  return undefined;
}

// GET 응답(document JSON)에서 MemberRecord를 복원. 필드 누락은 안전 기본값.
export function decodeMemberDocument(
  deviceId: string,
  doc: { fields?: Record<string, FsValue> } | null | undefined,
): MemberRecord {
  const fields = doc?.fields ?? {};
  const planRaw = fromValue(fields.plan);
  const plan: MemberPlan = planRaw === 'pro' ? 'pro' : 'free';
  return {
    deviceId,
    label: String(fromValue(fields.label) ?? ''),
    plan,
    note:
      typeof fromValue(fields.note) === 'string'
        ? (fromValue(fields.note) as string)
        : undefined,
    updatedAt: String(fromValue(fields.updatedAt) ?? ''),
  };
}

function docUrl(config: MembershipConfig, deviceId: string): string {
  return (
    `https://firestore.googleapis.com/v1/projects/${config.projectId}` +
    `/databases/(default)/documents/${config.collection}/` +
    `${encodeURIComponent(deviceId)}?key=${config.apiKey}`
  );
}

// 3상태 조회: found / absent(404) / error(네트워크·기타). absent와 error를
// 구분해야 자기등록·다운그레이드를 안전하게 결정할 수 있다.
export async function fetchMember(
  config: MembershipConfig,
  deviceId: string,
): Promise<FetchResult> {
  let res: Response;
  try {
    res = await fetch(docUrl(config, deviceId), { method: 'GET' });
  } catch {
    return { status: 'error' };
  }
  if (res.status === 404) return { status: 'absent' };
  if (!res.ok) return { status: 'error' };
  try {
    const doc = await res.json();
    return { status: 'found', record: decodeMemberDocument(deviceId, doc) };
  } catch {
    return { status: 'error' };
  }
}

// 자기등록: documentId=deviceId로 생성. 이미 있으면(409) 덮어쓰지 않는다.
// plan은 관리 모드 기본(무료)으로만 등록하고, 승격은 운영자가 한다.
export async function registerMember(
  config: MembershipConfig,
  record: MemberRecord,
): Promise<{ ok: boolean; existed: boolean }> {
  const url =
    `https://firestore.googleapis.com/v1/projects/${config.projectId}` +
    `/databases/(default)/documents/${config.collection}` +
    `?documentId=${encodeURIComponent(record.deviceId)}&key=${config.apiKey}`;
  const { deviceId: _omit, ...stored } = record;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: toFields(stored) }),
    });
  } catch {
    return { ok: false, existed: false };
  }
  if (res.status === 409) return { ok: true, existed: true };
  return { ok: res.ok, existed: false };
}
