import { DeliveryOrder } from '../domain';
import { FuelLog, MileageLog } from '../models';
import { RouteloSettings } from '../settings';

export const BACKUP_SCHEMA_VERSION = 1;

export type RouteloBackup = {
  app: 'routelo-for-ios';
  schemaVersion: number;
  exportedAt: string;
  orders: DeliveryOrder[];
  fuelLogs: FuelLog[];
  mileageLogs: MileageLog[];
  settings: RouteloSettings;
};

export type BackupInput = {
  orders: DeliveryOrder[];
  fuelLogs: FuelLog[];
  mileageLogs: MileageLog[];
  settings: RouteloSettings;
  exportedAt: string;
};

// Snapshots all local-first data into a versioned, self-describing object.
// This is the whole point of a local-first app's safety net, so keep it total:
// every persisted collection plus settings, tagged with a schema version for
// future restore.
export function buildBackup(input: BackupInput): RouteloBackup {
  return {
    app: 'routelo-for-ios',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: input.exportedAt,
    orders: input.orders,
    fuelLogs: input.fuelLogs,
    mileageLogs: input.mileageLogs,
    settings: input.settings,
  };
}

export function buildBackupJson(input: BackupInput): string {
  return JSON.stringify(buildBackup(input), null, 2);
}

export type ParseBackupResult =
  | { ok: true; backup: RouteloBackup }
  | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// Every persisted record is an object keyed by a string `id`. Requiring that
// much lets us reject junk elements (null, numbers, strings) that would
// otherwise be written verbatim and crash every render after restore, while
// still trusting the rest of a well-formed record.
const isRecordArray = (v: unknown): boolean =>
  Array.isArray(v) && v.every((el) => isObject(el) && typeof el.id === 'string');

// Pure, total validator for a restore. Never throws — every rejection is a
// typed error message the UI can show as-is. Mirrors `buildBackup`'s shape and
// refuses anything it can't safely restore (foreign file, newer schema, wrong
// collection types) rather than guessing. Zero-fabrication: we validate the
// envelope, not the individual records, so we never invent or drop data.
export function parseBackup(json: string): ParseBackupResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: '유효한 JSON이 아닙니다.' };
  }

  if (!isObject(raw)) {
    return { ok: false, error: 'Routelo 백업 형식이 아닙니다.' };
  }
  if (raw.app !== 'routelo-for-ios') {
    return { ok: false, error: 'Routelo 백업 파일이 아닙니다.' };
  }
  if (typeof raw.schemaVersion !== 'number' || !Number.isInteger(raw.schemaVersion)) {
    return { ok: false, error: '백업 스키마 버전을 읽을 수 없습니다.' };
  }
  if (raw.schemaVersion > BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `이 백업(v${raw.schemaVersion})은 현재 앱(v${BACKUP_SCHEMA_VERSION})보다 최신이라 복원할 수 없습니다. 앱을 업데이트하세요.`,
    };
  }
  if (raw.schemaVersion < 1) {
    return {
      ok: false,
      error: `지원하지 않는 백업 스키마 버전(v${raw.schemaVersion})입니다.`,
    };
  }
  if (
    !isRecordArray(raw.orders) ||
    !isRecordArray(raw.fuelLogs) ||
    !isRecordArray(raw.mileageLogs)
  ) {
    return { ok: false, error: '백업 데이터가 손상되었습니다(목록 형식 오류).' };
  }
  if (!isObject(raw.settings)) {
    return { ok: false, error: '백업 데이터가 손상되었습니다(설정 누락).' };
  }

  return {
    ok: true,
    backup: {
      app: 'routelo-for-ios',
      schemaVersion: raw.schemaVersion,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
      orders: raw.orders as DeliveryOrder[],
      fuelLogs: raw.fuelLogs as FuelLog[],
      mileageLogs: raw.mileageLogs as MileageLog[],
      settings: raw.settings as unknown as RouteloSettings,
    },
  };
}

// Side-effect boundary for restore: the caller injects the four persistence
// operations so this orchestration stays testable with fakes. Full-replace
// semantics — the backup becomes the new source of truth for every collection.
export type RestoreTargets = {
  saveOrders: (orders: DeliveryOrder[]) => Promise<void>;
  replaceFuelLogs: (logs: FuelLog[]) => Promise<void>;
  replaceMileageLogs: (logs: MileageLog[]) => Promise<void>;
  saveSettings: (settings: RouteloSettings) => Promise<void>;
};

export async function applyBackup(
  backup: RouteloBackup,
  targets: RestoreTargets,
): Promise<void> {
  await targets.saveOrders(backup.orders);
  await targets.replaceFuelLogs(backup.fuelLogs);
  await targets.replaceMileageLogs(backup.mileageLogs);
  await targets.saveSettings(backup.settings);
}
