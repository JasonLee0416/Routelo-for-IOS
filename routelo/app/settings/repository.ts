import { KeyValueStore } from '../repositories';
import { migrateLegacySettings, mergeSettingsV2 } from './migrations';
import { LegacyFeeSettings, RouteloSettings } from './schema';

export const SETTINGS_V1_KEY = '@routelo/settings/v1';
export const SETTINGS_V2_KEY = '@routelo/settings/v2';

export class SettingsRepository {
  constructor(private readonly store: KeyValueStore) {}

  async get(): Promise<RouteloSettings> {
    const current = await this.store.getItem(SETTINGS_V2_KEY);
    if (current) {
      try {
        return mergeSettingsV2(JSON.parse(current));
      } catch {
        return mergeSettingsV2();
      }
    }

    const legacy = await this.store.getItem(SETTINGS_V1_KEY);
    let migrated: RouteloSettings;
    try {
      migrated = migrateLegacySettings(
        legacy ? (JSON.parse(legacy) as LegacyFeeSettings) : null,
      );
    } catch {
      migrated = migrateLegacySettings();
    }
    await this.save(migrated);
    return migrated;
  }

  async save(settings: RouteloSettings) {
    const normalized = mergeSettingsV2(settings);
    await this.store.setItem(SETTINGS_V2_KEY, JSON.stringify(normalized));
  }

  async clear() {
    await this.store.removeItem(SETTINGS_V2_KEY);
  }
}
