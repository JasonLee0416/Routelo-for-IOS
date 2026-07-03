import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  LocalDeliveryRepository,
  LocalFuelLogRepository,
  LocalReceiptRepository,
  LocalRoutePlanRepository,
} from './local';

export const deliveryRepository = new LocalDeliveryRepository(AsyncStorage);
export const receiptRepository = new LocalReceiptRepository(AsyncStorage);
export const routePlanRepository = new LocalRoutePlanRepository(AsyncStorage);
export const fuelLogRepository = new LocalFuelLogRepository(AsyncStorage);

