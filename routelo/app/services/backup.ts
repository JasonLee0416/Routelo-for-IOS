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
