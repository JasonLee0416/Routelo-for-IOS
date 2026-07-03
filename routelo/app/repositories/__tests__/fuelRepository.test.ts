import { FuelLog } from '../../models';
import { KeyValueStore } from '../contracts';
import { LocalFuelLogRepository } from '../local';

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

const log = (id: string, date: string): FuelLog => ({
  id,
  date,
  liters: 30,
  pricePerLiter: 1700,
  amount: 51000,
  odometerKm: 0,
});

describe('LocalFuelLogRepository', () => {
  test('saves, upserts, lists, and removes', async () => {
    const repo = new LocalFuelLogRepository(new MemoryStore());
    expect(await repo.list()).toEqual([]);

    await repo.save(log('f1', '2026-07-01'));
    await repo.save(log('f2', '2026-07-02'));
    expect((await repo.list()).map((entry) => entry.id)).toEqual(['f1', 'f2']);

    await repo.save({ ...log('f1', '2026-07-01'), amount: 60000 });
    const afterUpsert = await repo.list();
    expect(afterUpsert).toHaveLength(2);
    expect(afterUpsert.find((entry) => entry.id === 'f1')?.amount).toBe(60000);

    await repo.remove('f1');
    expect((await repo.list()).map((entry) => entry.id)).toEqual(['f2']);
  });

  test('survives a fresh repository instance over the same store', async () => {
    const store = new MemoryStore();
    await new LocalFuelLogRepository(store).save(log('f1', '2026-07-01'));
    const reopened = await new LocalFuelLogRepository(store).list();
    expect(reopened.map((entry) => entry.id)).toEqual(['f1']);
  });
});
