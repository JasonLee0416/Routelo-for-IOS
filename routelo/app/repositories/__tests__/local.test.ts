import {
  LEGACY_DELIVERY_KEY,
  LocalDeliveryRepository,
  LocalReceiptRepository,
} from '../local';
import { KeyValueStore } from '../contracts';
import { DOMAIN_SCHEMA_VERSION, ReceiptDocument } from '../../domain';

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

const legacy = {
  id: 'user-delivery-1',
  orderVendor: '발주화원',
  orderVendorTel: '',
  deliveryVendor: '',
  deliveryVendorTel: '',
  productName: '근조화환',
  productQuantity: 1,
  eventTime: '',
  deliveryDt: '2026-06-30 10:00',
  deliveryAddress: '서울 구로구 테스트로 1',
  customerRequests: '',
  recipientTel: '',
  status: 'pending',
  distanceKm: 0,
  fee: 0,
  latitude: 0,
  longitude: 0,
};

describe('local repositories', () => {
  it('migrates legacy user records once and skips bundled samples', async () => {
    const store = new MemoryStore();
    await store.setItem(
      LEGACY_DELIVERY_KEY,
      JSON.stringify({
        deliveries: [legacy, { ...legacy, id: 'delivery-1' }],
      }),
    );
    const repository = new LocalDeliveryRepository(store);
    await repository.initialize();
    await repository.initialize();
    const orders = await repository.list();
    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe('user-delivery-1');
  });

  it('queries canonical orders across date ranges in time order', async () => {
    const repository = new LocalDeliveryRepository(new MemoryStore());
    await repository.initialize();
    const first = {
      schemaVersion: DOMAIN_SCHEMA_VERSION,
      id: 'first',
      orderingVendor: {},
      fulfillingVendor: {},
      product: { name: '화환' },
      schedule: {
        serviceDate: '2026-07-01',
        timezone: 'Asia/Seoul',
        strictDeadlineAt: '2026-07-01T09:00:00+09:00',
        timePrecision: 'exact' as const,
        priority: 'normal' as const,
      },
      destination: {},
      recipient: {},
      status: 'pending' as const,
      settlement: {},
      source: { type: 'manual' as const },
      createdAt: '2026-06-23T00:00:00Z',
      updatedAt: '2026-06-23T00:00:00Z',
    };
    await repository.saveAll([
      {
        ...first,
        id: 'second',
        schedule: {
          ...first.schedule,
          strictDeadlineAt: '2026-07-01T11:00:00+09:00',
        },
      },
      first,
    ]);
    expect(
      (await repository.listByDateRange('2026-07-01', '2026-07-31')).map(
        (order) => order.id,
      ),
    ).toEqual(['first', 'second']);
  });

  it('round-trips receipt evidence and linkage', async () => {
    const repository = new LocalReceiptRepository(new MemoryStore());
    const receipt: ReceiptDocument = {
      schemaVersion: DOMAIN_SCHEMA_VERSION,
      id: 'receipt-1',
      capturedAt: '2026-06-23T00:00:00Z',
      recognition: {
        engine: 'ppocrv5',
        processingMs: 10,
        fullText: '실제 원문',
        lines: [],
      },
      extraction: {
        registryVersion: 3,
        fields: {},
        unmappedLines: [],
        documentConfidence: 0,
      },
      review: {
        status: 'reviewRequired',
        corrections: [],
      },
    };
    await repository.save(receipt);
    await repository.linkDelivery(receipt.id, 'delivery-1');
    expect((await repository.get(receipt.id))?.linkedDeliveryId).toBe(
      'delivery-1',
    );
  });
});
