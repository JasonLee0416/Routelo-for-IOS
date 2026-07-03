import { DeliveryOrder } from '../../domain';
import { FuelLog, MileageLog } from '../../models';
import { DEFAULT_ROUTELO_SETTINGS } from '../../settings';
import {
  BACKUP_SCHEMA_VERSION,
  buildBackup,
  buildBackupJson,
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
