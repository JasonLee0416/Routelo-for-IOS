import AsyncStorage from '@react-native-async-storage/async-storage';

import { OcrFieldResult, OcrPipelineResult } from '../models';
import { TELEMETRY_CONFIG, isTelemetryConfigured } from './config';
import { buildScanEvent } from './events';
import { uploadEvents } from './firestore';
import { TelemetryQueue } from './queue';

// 품질 리포트 오케스트레이터. 동의(enabled)와 설정(config)이 모두 있을 때만 동작하며,
// 이벤트를 로컬 큐에 쌓고 온라인일 때 Firestore로 비운다.

const DEVICE_ID_KEY = 'routelo.telemetry.deviceId';
const APP_VERSION = '1.0.0'; // 리포트에 찍히는 버전(릴리스 시 함께 갱신)
const BATCH = 25;

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let deviceIdCache: string | undefined;
async function getDeviceId(): Promise<string> {
  if (deviceIdCache) return deviceIdCache;
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = uuid(); // 익명 설치 ID — 개인 식별과 무관
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  deviceIdCache = id;
  return id;
}

const queue = new TelemetryQueue(AsyncStorage);

export type TelemetryConsent = { enabled: boolean };

function active(consent: TelemetryConsent): boolean {
  return consent.enabled && isTelemetryConfigured();
}

// 검수 등록 시 호출: 원본 OCR ↔ 사용자 확정 교정쌍을 이벤트로 적재하고 전송 시도.
export async function recordScanReview(
  result: OcrPipelineResult,
  finalFields: OcrFieldResult[],
  consent: TelemetryConsent,
): Promise<void> {
  if (!active(consent)) return;
  const deviceId = await getDeviceId();
  const event = buildScanEvent(result, finalFields, {
    id: uuid(),
    ts: Date.now(),
    deviceId,
    appVersion: APP_VERSION,
  });
  await queue.enqueue([event]);
  flush(consent).catch(() => undefined);
}

let flushing = false;
export async function flush(consent: TelemetryConsent): Promise<void> {
  if (!active(consent) || flushing) return;
  flushing = true;
  try {
    for (;;) {
      const batch = await queue.peek(BATCH);
      if (!batch.length) break;
      const { acked } = await uploadEvents(TELEMETRY_CONFIG, batch);
      if (!acked.length) break; // 진전 없음(오프라인/거부) → 다음 기회에
      await queue.ack(acked);
      if (acked.length < batch.length) break; // 일부 실패 → 중단
    }
  } finally {
    flushing = false;
  }
}

export async function pendingReportCount(): Promise<number> {
  return queue.size();
}
