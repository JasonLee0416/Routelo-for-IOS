import AsyncStorage from '@react-native-async-storage/async-storage';

import { AccountRepository } from './repository';

export const accountRepository = new AccountRepository(AsyncStorage);

