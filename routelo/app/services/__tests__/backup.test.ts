import { DeliveryOrder } from '../../domain';
import { FuelLog, MileageLog } from '../../models';
import { DEFAULT_ROUTELO_SETTINGS } from '../../settings';
import {
  applyBackup,
  BACKUP_SCHEMA_VERSION,
  buildBackup,
  buildBackupJson,
  parseBackup,
  RestoreTargets,
} from '../backup';

const order = { id: 'd1', status: 'pending' } as unknown as DeliveryOrder;
const fuel: FuelLog = {
  id: 'f1',
  date: '2026-07-03',
  liters: 30,
  pricePerLiter: 1700,
  amount: 51000,
  odometerKm: 0,
};
const mileage: MileageLog = {
  id: 'm1',
  date: '2026-07-03',
  odometerKm: 12345,
  dailyDistanceKm: 40,
};

const input = {
  orders: [order],
  fuelLogs: [fuel],
  mileageLogs: [mileage],
  settings: DEFAULT_ROUTELO_SETTINGS,
  exportedAt: '2026-07-04T00:00:00.000Z',
};

describe('buildBackup', () => {
  test('captures every collection with schema metadata', () => {
    const backup = buildBackup(input);
    expect(backup.app).toBe('routelo-for-ios');
    expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(backup.exportedAt).toBe('2026-07-04T00:00:00.000Z');
    expect(backup.orders).toHaveLength(1);
    expect(backup.fuelLogs).toHaveLength(1);
    expect(backup.mileageLogs).toHaveLength(1);
    expect(backup.settings).toBe(DEFAULT_ROUTELO_SETTINGS);
  });
});

describe('buildBackupJson', () => {
  test('produces JSON that round-trips back to the same data', () => {
    const json = buildBackupJson(input);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(buildBackup(input));
    expect(parsed.fuelLogs[0].amount).toBe(51000);
    expect(parsed.mileageLogs[0].dailyDistanceKm).toBe(40);
  });
});

describe('parseBackup', () => {
  test('accepts a backup produced by buildBackupJson (round-trip)', () => {
    const result = parseBackup(buildBackupJson(input));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup).toEqual(buildBackup(input));
    expect(result.backup.orders).toHaveLength(1);
    expect(result.backup.fuelLogs[0].amount).toBe(51000);
  });

  test('rejects invalid JSON', () => {
    const result = parseBackup('{not json');
    expect(result).toEqual({ ok: false, error: '유효한 JSON이 아닙니다.' });
  });

  test('rejects non-object / array payloads', () => {
    expect(parseBackup('[]').ok).toBe(false);
    expect(parseBackup('42').ok).toBe(false);
    expect(parseBackup('null').ok).toBe(false);
  });

  test('rejects a file from another app', () => {
    const foreign = JSON.stringify({ ...buildBackup(input), app: 'other-app' });
    const result = parseBackup(foreign);
    expect(result).toEqual({ ok: false, error: 'Routelo 백업 파일이 아닙니다.' });
  });

  test('rejects a newer schema version it cannot understand', () => {
    const future = JSON.stringify({
      ...buildBackup(input),
      schemaVersion: BACKUP_SCHEMA_VERSION + 1,
    });
    const result = parseBackup(future);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('최신');
  });

  test('rejects a missing/invalid schema version', () => {
    const noVersion = JSON.stringify({ ...buildBackup(input), schemaVersion: '1' });
    expect(parseBackup(noVersion).ok).toBe(false);
  });

  test('rejects a zero / negative / non-integer schema version', () => {
    for (const v of [0, -1, 0.5, NaN]) {
      const bad = JSON.stringify({ ...buildBackup(input), schemaVersion: v });
      expect(parseBackup(bad).ok).toBe(false);
    }
  });

  test('rejects corrupt collections (list not an array)', () => {
    const corrupt = JSON.stringify({ ...buildBackup(input), fuelLogs: null });
    const result = parseBackup(corrupt);
    expect(result).toEqual({
      ok: false,
      error: '백업 데이터가 손상되었습니다(목록 형식 오류).',
    });
  });

  test('rejects arrays containing non-object / id-less records', () => {
    expect(
      parseBackup(JSON.stringify({ ...buildBackup(input), orders: [null, 5] })).ok,
    ).toBe(false);
    expect(
      parseBackup(
        JSON.stringify({ ...buildBackup(input), fuelLogs: [{ date: 'x' }] }),
      ).ok,
    ).toBe(false);
  });

  test('rejects settings that is an array, not an object', () => {
    const corrupt = JSON.stringify({ ...buildBackup(input), settings: [] });
    expect(parseBackup(corrupt).ok).toBe(false);
  });

  test('rejects a missing settings object', () => {
    const corrupt = JSON.stringify({ ...buildBackup(input), settings: undefined });
    expect(parseBackup(corrupt).ok).toBe(false);
  });

  test('tolerates a missing exportedAt by defaulting to empty string', () => {
    const { exportedAt, ...rest } = buildBackup(input);
    void exportedAt;
    const result = parseBackup(JSON.stringify(rest));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.exportedAt).toBe('');
  });
});

describe('applyBackup', () => {
  test('persists every collection through the injected targets, in order', async () => {
    const calls: string[] = [];
    const targets: RestoreTargets = {
      saveOrders: async (o) => {
        calls.push(`orders:${o.length}`);
      },
      replaceFuelLogs: async (f) => {
        calls.push(`fuel:${f.length}`);
      },
      replaceMileageLogs: async (m) => {
        calls.push(`mileage:${m.length}`);
      },
      saveSettings: async () => {
        calls.push('settings');
      },
    };
    await applyBackup(buildBackup(input), targets);
    expect(calls).toEqual(['orders:1', 'fuel:1', 'mileage:1', 'settings']);
  });

  test('propagates a persistence failure to the caller', async () => {
    const targets: RestoreTargets = {
      saveOrders: async () => undefined,
      replaceFuelLogs: async () => {
        throw new Error('disk full');
      },
      replaceMileageLogs: async () => undefined,
      saveSettings: async () => undefined,
    };
    await expect(applyBackup(buildBackup(input), targets)).rejects.toThrow(
      'disk full',
    );
  });
});
