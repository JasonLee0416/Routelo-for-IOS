import { ContactLog } from '../../models';
import { KeyValueStore } from '../contracts';
import { LocalContactLogRepository } from '../local';

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

const log = (id: string): ContactLog => ({
  id,
  deliveryId: 'd1',
  channel: 'recipient',
  label: '수령인',
  phone: '01011112222',
  at: '2026-07-09T05:00:00.000Z',
});

describe('LocalContactLogRepository', () => {
  test('saves, upserts, lists, and removes', async () => {
    const repo = new LocalContactLogRepository(new MemoryStore());
    expect(await repo.list()).toEqual([]);

    await repo.save(log('c1'));
    await repo.save(log('c2'));
    expect((await repo.list()).map((entry) => entry.id)).toEqual(['c1', 'c2']);

    await repo.save({ ...log('c1'), phone: '029998888' });
    const afterUpsert = await repo.list();
    expect(afterUpsert).toHaveLength(2);
    expect(afterUpsert.find((entry) => entry.id === 'c1')?.phone).toBe('029998888');

    await repo.remove('c1');
    expect((await repo.list()).map((entry) => entry.id)).toEqual(['c2']);
  });

  test('replaceAll overwrites the whole collection (restore semantics)', async () => {
    const repo = new LocalContactLogRepository(new MemoryStore());
    await repo.save(log('old'));
    await repo.replaceAll([log('c1'), log('c2')]);
    expect((await repo.list()).map((entry) => entry.id)).toEqual(['c1', 'c2']);
    await repo.replaceAll([]);
    expect(await repo.list()).toEqual([]);
  });
});
