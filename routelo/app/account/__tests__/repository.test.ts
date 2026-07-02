import { KeyValueStore } from '../../repositories';
import { AccountRepository } from '../repository';

class MemoryStore implements KeyValueStore {
  values = new Map<string, string>();
  async getItem(key: string) {
    return this.values.get(key) || null;
  }
  async setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  async removeItem(key: string) {
    this.values.delete(key);
  }
}

describe('account repository', () => {
  it('persists profile and vehicles without credentials', async () => {
    const repository = new AccountRepository(new MemoryStore());
    await repository.save({
      profile: {
        schemaVersion: 1,
        id: 'guest-1',
        accountMode: 'guest',
        plan: 'guest',
        status: 'active',
        displayName: '게스트 기사',
        createdAt: '2026-06-23T00:00:00Z',
        updatedAt: '2026-06-23T00:00:00Z',
      },
      vehicles: [],
    });
    const state = await repository.get();
    expect(state?.profile.accountMode).toBe('guest');
    expect(JSON.stringify(state)).not.toContain('password');
  });
});

