import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  LocalDeliveryRepository,
  LocalReceiptRepository,
  LocalRoutePlanRepository,
} from './local';

export const deliveryRepository = new LocalDeliveryRepository(AsyncStorage);
export const receiptRepository = new LocalReceiptRepository(AsyncStorage);
export const routePlanRepository = new LocalRoutePlanRepository(AsyncStorage);

