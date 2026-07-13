import { TelemetryEvent } from './schema';
import { TelemetryConfig } from './config';

// Firestore REST 업로더 — 네이티브 SDK 없이 fetch만 사용. 이벤트 id를 문서 id로
// 써서 멱등(중복 업로드는 409 → 성공 취급). 2xx/409만 ack하고, 그 외 오류는 중단해
// 다음 기회에 재시도한다.

type FsValue = Record<string, unknown>;

function toValue(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number')
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object')
    return { mapValue: { fields: toFields(v as Record<string, unknown>) } };
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

export async function uploadEvents(
  config: TelemetryConfig,
  events: TelemetryEvent[],
): Promise<{ acked: string[] }> {
  const acked: string[] = [];
  for (const ev of events) {
    const url =
      `https://firestore.googleapis.com/v1/projects/${config.projectId}` +
      `/databases/(default)/documents/${config.collection}` +
      `?documentId=${encodeURIComponent(ev.id)}&key=${config.apiKey}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: toFields(ev as unknown as Record<string, unknown>) }),
      });
    } catch {
      break; // 네트워크 실패 → 나머지는 다음 기회에
    }
    if (res.ok || res.status === 409) acked.push(ev.id);
    else break; // 서버 거부(규칙/쿼터 등) → 중단, 재시도
  }
  return { acked };
}
