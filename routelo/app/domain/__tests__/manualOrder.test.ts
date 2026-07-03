import {
  applyManualEdit,
  createManualDeliveryOrder,
  ManualOrderInput,
  orderToManualInput,
  validateManualOrderInput,
} from '../manualOrder';
import { DeliveryOrder } from '../models';

const NOW = '2026-07-03T00:00:00.000Z';

const baseInput: ManualOrderInput = {
  productName: '축하 화환 3단',
  productQuantity: 2,
  orderingVendorName: '행복꽃집',
  orderingVendorTel: '021234567',
  deliveryAddress: '서울시 강남구 테헤란로 1',
  venueName: '강남 웨딩홀',
  recipientName: '홍길동',
  recipientTel: '01099998888',
  serviceDate: '2026-07-10',
  strictTime: '13:00',
  eventTime: '14:00',
  customerRequests: '정문에서 수령',
};

describe('validateManualOrderInput', () => {
  test('accepts a complete input', () => {
    expect(validateManualOrderInput(baseInput)).toEqual([]);
  });

  test('requires a product name', () => {
    expect(validateManualOrderInput({ ...baseInput, productName: '   ' })).toContain(
      '상품명을 입력해주세요.',
    );
  });

  test('rejects malformed date and time', () => {
    const errors = validateManualOrderInput({
      ...baseInput,
      serviceDate: '2026/07/10',
      strictTime: '1300',
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        '배송 날짜 형식은 YYYY-MM-DD 입니다.',
        '엄수 시간 형식은 HH:mm 입니다.',
      ]),
    );
  });

  test('requires a service date when a time is given', () => {
    expect(
      validateManualOrderInput({
        productName: '화분',
        strictTime: '10:00',
      }),
    ).toContain('엄수 시간을 쓰려면 배송 날짜가 필요합니다.');
  });

  test('rejects a negative or non-integer quantity', () => {
    expect(
      validateManualOrderInput({ productName: '화분', productQuantity: -1 }),
    ).toContain('수량은 0 이상의 정수여야 합니다.');
    expect(
      validateManualOrderInput({ productName: '화분', productQuantity: 1.5 }),
    ).toContain('수량은 0 이상의 정수여야 합니다.');
  });
});

describe('createManualDeliveryOrder', () => {
  test('builds a canonical manual order with composed schedule', () => {
    const order = createManualDeliveryOrder(baseInput, { id: 'delivery-1', now: NOW });
    expect(order).toMatchObject({
      schemaVersion: 1,
      id: 'delivery-1',
      status: 'pending',
      source: { type: 'manual' },
      createdAt: NOW,
      updatedAt: NOW,
      orderingVendor: { name: '행복꽃집', telephone: '021234567' },
      product: { name: '축하 화환 3단', category: 'congratulation', quantity: 2 },
      destination: { venueName: '강남 웨딩홀', address: '서울시 강남구 테헤란로 1' },
      recipient: { name: '홍길동', telephone: '01099998888' },
      customerRequests: '정문에서 수령',
    });
    expect(order.schedule).toMatchObject({
      serviceDate: '2026-07-10',
      timezone: 'Asia/Seoul',
      strictDeadlineAt: '2026-07-10T13:00:00+09:00',
      eventAt: '2026-07-10T14:00:00+09:00',
      timePrecision: 'exact',
      priority: 'critical',
    });
  });

  test('never mis-tags a delivery-* id as sample (regression vs legacy adapter)', () => {
    const order = createManualDeliveryOrder(
      { productName: '화분' },
      { id: 'delivery-1751500000000', now: NOW },
    );
    expect(order.source.type).toBe('manual');
  });

  test('degrades schedule precision when only a date or nothing is given', () => {
    const dateOnly = createManualDeliveryOrder(
      { productName: '화분', serviceDate: '2026-07-10' },
      { id: 'd1', now: NOW },
    );
    expect(dateOnly.schedule.timePrecision).toBe('date-only');
    expect(dateOnly.schedule.priority).toBe('normal');
    expect(dateOnly.schedule.strictDeadlineAt).toBeUndefined();

    const none = createManualDeliveryOrder(
      { productName: '화분' },
      { id: 'd2', now: NOW },
    );
    expect(none.schedule.timePrecision).toBe('unknown');
    expect(none.schedule.serviceDate).toBeUndefined();
  });

  test('drops blank optional fields and non-positive quantity', () => {
    const order = createManualDeliveryOrder(
      { productName: '화분', productQuantity: 0, deliveryAddress: '   ' },
      { id: 'd3', now: NOW },
    );
    expect(order.product.quantity).toBeUndefined();
    expect(order.destination.address).toBeUndefined();
  });

  test('throws on invalid input', () => {
    expect(() =>
      createManualDeliveryOrder({ productName: '' }, { id: 'd4', now: NOW }),
    ).toThrow('상품명');
  });
});

describe('applyManualEdit', () => {
  const existing: DeliveryOrder = createManualDeliveryOrder(baseInput, {
    id: 'delivery-1',
    now: '2026-07-01T00:00:00.000Z',
  });

  test('updates fields while preserving identity, source, status, and completion', () => {
    const completed: DeliveryOrder = {
      ...existing,
      status: 'completed',
      schedule: { ...existing.schedule, completedAt: '2026-07-02T05:00:00.000Z' },
      settlement: { fee: 8000, district: '강남구' },
    };
    const edited = applyManualEdit(
      completed,
      { ...baseInput, productName: '근조 화환', recipientTel: '01011112222' },
      '2026-07-03T09:00:00.000Z',
    );
    expect(edited.id).toBe('delivery-1');
    expect(edited.createdAt).toBe(existing.createdAt);
    expect(edited.source.type).toBe('manual');
    expect(edited.status).toBe('completed');
    expect(edited.schedule.completedAt).toBe('2026-07-02T05:00:00.000Z');
    expect(edited.settlement).toEqual({ fee: 8000, district: '강남구' });
    expect(edited.product).toMatchObject({ name: '근조 화환', category: 'condolence' });
    expect(edited.recipient.telephone).toBe('01011112222');
    expect(edited.updatedAt).toBe('2026-07-03T09:00:00.000Z');
  });

  test('throws on invalid edit input', () => {
    expect(() => applyManualEdit(existing, { productName: '' }, NOW)).toThrow();
  });
});

describe('orderToManualInput', () => {
  test('round-trips the form fields through create', () => {
    const order = createManualDeliveryOrder(baseInput, { id: 'd1', now: NOW });
    expect(orderToManualInput(order)).toEqual({
      productName: '축하 화환 3단',
      productQuantity: 2,
      orderingVendorName: '행복꽃집',
      orderingVendorTel: '021234567',
      fulfillingVendorName: undefined,
      fulfillingVendorTel: undefined,
      serviceDate: '2026-07-10',
      strictTime: '13:00',
      eventTime: '14:00',
      venueName: '강남 웨딩홀',
      deliveryAddress: '서울시 강남구 테헤란로 1',
      recipientName: '홍길동',
      recipientTel: '01099998888',
      customerRequests: '정문에서 수령',
    });
  });
});
