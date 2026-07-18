import {
  canScan,
  FREE_DAILY_SCAN_LIMIT,
  isFeatureEnabled,
  remainingFreeScans,
  resolvePlan,
} from '../plan';
import { getTodayScanCount, incrementScanCount, KVStore } from '../usage';

describe('plan entitlement', () => {
  it('resolves plan, defaulting undefined to pro (founding member)', () => {
    expect(resolvePlan(undefined)).toBe('pro');
    expect(resolvePlan({})).toBe('pro');
    expect(resolvePlan({ plan: 'free' })).toBe('free');
    expect(resolvePlan({ plan: 'pro' })).toBe('pro');
  });

  it('gates Pro features for free, opens for pro', () => {
    expect(isFeatureEnabled('free', 'dataExport')).toBe(false);
    expect(isFeatureEnabled('free', 'multiVehicle')).toBe(false);
    expect(isFeatureEnabled('pro', 'dataExport')).toBe(true);
  });

  it('enforces free daily scan limit; pro is unlimited', () => {
    expect(canScan('free', FREE_DAILY_SCAN_LIMIT - 1)).toBe(true);
    expect(canScan('free', FREE_DAILY_SCAN_LIMIT)).toBe(false);
    expect(canScan('pro', 9999)).toBe(true);
    expect(remainingFreeScans('free', 2)).toBe(FREE_DAILY_SCAN_LIMIT - 2);
    expect(remainingFreeScans('pro', 100)).toBe(Infinity);
  });
});

class MemStore implements KVStore {
  private map = new Map<string, string>();
  async getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  async setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

describe('scan usage counter', () => {
  const day1 = new Date('2026-07-14T09:00:00Z');
  const day2 = new Date('2026-07-15T09:00:00Z');

  it('increments within a day and resets on a new day', async () => {
    const store = new MemStore();
    expect(await getTodayScanCount(store, day1)).toBe(0);
    expect(await incrementScanCount(store, day1)).toBe(1);
    expect(await incrementScanCount(store, day1)).toBe(2);
    expect(await getTodayScanCount(store, day1)).toBe(2);
    // 다음 날 → 0으로 리셋
    expect(await getTodayScanCount(store, day2)).toBe(0);
    expect(await incrementScanCount(store, day2)).toBe(1);
  });
});
