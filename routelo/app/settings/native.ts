import AsyncStorage from '@react-native-async-storage/async-storage';

import { SettingsRepository } from './repository';

export const settingsRepository = new SettingsRepository(AsyncStorage);
