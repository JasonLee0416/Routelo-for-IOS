import { MileageLog } from '../../models';
import { KeyValueStore } from '../contracts';
import { LocalMileageLogRepository } from '../local';

class MemoryStore implements KeyValueStore {
  private readonly map = new Map<string, string>();
  async getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  async removeItem(key: string) {
    this.map.delete(key);
  }
}

const log = (id: string, date: string): MileageLog => ({
  id,
  date,
  odometerKm: 12345,
  dailyDistanceKm: 40,
});

describe('LocalMileageLogRepository', () => {
  test('saves, upserts, lists, and removes', async () => {
    const repo = new LocalMileageLogRepository(new MemoryStore());
    expect(await repo.list()).toEqual([]);

    await repo.save(log('m1', '2026-07-01'));
    await repo.save(log('m2', '2026-07-02'));
    expect((await repo.list()).map((entry) => entry.id)).toEqual(['m1', 'm2']);

    await repo.save({ ...log('m1', '2026-07-01'), dailyDistanceKm: 99 });
    const afterUpsert = await repo.list();
    expect(afterUpsert).toHaveLength(2);
    expect(afterUpsert.find((entry) => entry.id === 'm1')?.dailyDistanceKm).toBe(
      99,
    );

    await repo.remove('m1');
    expect((await repo.list()).map((entry) => entry.id)).toEqual(['m2']);
  });
});
