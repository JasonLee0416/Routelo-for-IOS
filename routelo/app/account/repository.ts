import { KeyValueStore } from '../repositories';
import { AccountState } from './models';

const ACCOUNT_KEY = '@routelo/account-state/v1';

export class AccountRepository {
  constructor(private readonly store: KeyValueStore) {}

  async get(): Promise<AccountState | null> {
    const raw = await this.store.getItem(ACCOUNT_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as AccountState;
      if (!parsed.profile || !Array.isArray(parsed.vehicles)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  async save(state: AccountState) {
    await this.store.setItem(ACCOUNT_KEY, JSON.stringify(state));
  }

  async clear() {
    await this.store.removeItem(ACCOUNT_KEY);
  }
}

