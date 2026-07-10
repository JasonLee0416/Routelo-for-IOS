import * as FileSystem from '../platform/fs';

import { DEFAULT_FIELD_REGISTRY, FieldDef, FIELD_REGISTRY_VERSION } from './fieldRegistry';
import { ReceiptRecord } from './schema';

// OCR 결과를 앱 상태가 아니라 외부 JSON 파일로 저장한다.
// - 무손실: raw 원문 + unmapped 보존
// - 경량: JSON.stringify 압축(들여쓰기 없음)
// - 편집 가능: 파일 단위라 추후 export/수정/재매핑 용이
const ROOT = `${FileSystem.documentDirectory}routelo/`;
const RECEIPTS_DIR = `${ROOT}receipts/`;
const REGISTRY_FILE = `${ROOT}field-registry.json`;

type RegistryFile = { version: number; fields: FieldDef[] };

async function ensureDir(dir: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

// ---- 인수증 레코드 ----

export async function saveReceipt(record: ReceiptRecord): Promise<void> {
  await ensureDir(RECEIPTS_DIR);
  await FileSystem.writeAsStringAsync(
    `${RECEIPTS_DIR}${record.id}.json`,
    JSON.stringify(record),
  );
}

export async function listReceipts(): Promise<ReceiptRecord[]> {
  await ensureDir(RECEIPTS_DIR);
  const names = await FileSystem.readDirectoryAsync(RECEIPTS_DIR);
  const records: ReceiptRecord[] = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    try {
      const text = await FileSystem.readAsStringAsync(`${RECEIPTS_DIR}${name}`);
      records.push(JSON.parse(text) as ReceiptRecord);
    } catch {
      // 손상된 파일은 건너뛴다 (다른 레코드까지 막지 않도록)
    }
  }
  // 최신순
  return records.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

export async function getReceipt(id: string): Promise<ReceiptRecord | null> {
  const path = `${RECEIPTS_DIR}${id}.json`;
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;
  const text = await FileSystem.readAsStringAsync(path);
  return JSON.parse(text) as ReceiptRecord;
}

export async function deleteReceipt(id: string): Promise<void> {
  const path = `${RECEIPTS_DIR}${id}.json`;
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) await FileSystem.deleteAsync(path, { idempotent: true });
}

// ---- 별칭 레지스트리 ----

// 저장된 레지스트리를 읽되, 없거나 손상되면 기본값을 쓰고 새로 기록한다.
export async function loadRegistry(): Promise<FieldDef[]> {
  const info = await FileSystem.getInfoAsync(REGISTRY_FILE);
  if (info.exists) {
    try {
      const parsed = JSON.parse(await FileSystem.readAsStringAsync(REGISTRY_FILE)) as RegistryFile;
      if (Array.isArray(parsed.fields) && parsed.fields.length) return parsed.fields;
    } catch {
      // 손상 → 기본값으로 복구
    }
  }
  await saveRegistry(DEFAULT_FIELD_REGISTRY);
  return DEFAULT_FIELD_REGISTRY;
}

export async function saveRegistry(fields: FieldDef[]): Promise<void> {
  await ensureDir(ROOT);
  const payload: RegistryFile = { version: FIELD_REGISTRY_VERSION, fields };
  await FileSystem.writeAsStringAsync(REGISTRY_FILE, JSON.stringify(payload));
}

// 사용자가 매핑 실패 라벨을 특정 필드에 수동 연결하면 별칭으로 학습.
// 다음 인수증부터는 정확매칭으로 바로 잡힌다.
export async function addAlias(key: string, alias: string): Promise<FieldDef[]> {
  const trimmed = alias.trim();
  if (!trimmed) return loadRegistry();
  const fields = await loadRegistry();
  const def = fields.find((field) => field.key === key);
  if (def && !def.aliases.includes(trimmed) && def.label !== trimmed) {
    def.aliases.push(trimmed);
    await saveRegistry(fields);
  }
  return fields;
}
