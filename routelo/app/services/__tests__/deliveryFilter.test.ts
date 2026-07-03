import { Delivery } from '../../models';
import { filterDeliveries, sortDeliveries } from '../deliveryFilter';

const base: Delivery = {
  id: 'd0',
  orderVendor: '',
  orderVendorTel: '',
  deliveryVendor: '',
  deliveryVendorTel: '',
  productName: '',
  productQuantity: 1,
  eventTime: '',
  deliveryDt: '',
  deliveryAddress: '',
  customerRequests: '',
  recipientTel: '',
  status: 'pending',
  distanceKm: 0,
  fee: 0,
  latitude: 0,
  longitude: 0,
};

const deliveries: Delivery[] = [
  {
    ...base,
    id: 'd1',
    productName: '축하 3단 화환',
    deliveryAddress: '서울시 강남구 테헤란로 1',
    orderVendor: '행복꽃집',
    recipientTel: '01011112222',
    deliveryDt: '2026-07-10 13:00',
    status: 'pending',
  },
  {
    ...base,
    id: 'd2',
    productName: '근조 화환',
    deliveryAddress: '서울시 서초구 반포대로 2',
    orderVendor: '평화상조',
    recipientTel: '01033334444',
    deliveryDt: '2026-07-11 09:00',
    status: 'completed',
  },
  {
    ...base,
    id: 'd3',
    productName: '관엽 화분',
    deliveryAddress: '경기도 성남시 분당구',
    orderVendor: '초록원예',
    deliveryDt: '2026-07-10 15:00',
    status: 'pending',
  },
];

describe('filterDeliveries', () => {
  test('returns everything with no criteria', () => {
    expect(filterDeliveries(deliveries, {}).map((d) => d.id)).toEqual([
      'd1',
      'd2',
      'd3',
    ]);
  });

  test('filters by status', () => {
    expect(
      filterDeliveries(deliveries, { status: 'pending' }).map((d) => d.id),
    ).toEqual(['d1', 'd3']);
    expect(
      filterDeliveries(deliveries, { status: 'completed' }).map((d) => d.id),
    ).toEqual(['d2']);
  });

  test('matches text across product, address, and vendor (case-insensitive)', () => {
    expect(filterDeliveries(deliveries, { query: '화환' }).map((d) => d.id)).toEqual([
      'd1',
      'd2',
    ]);
    expect(filterDeliveries(deliveries, { query: '분당' }).map((d) => d.id)).toEqual([
      'd3',
    ]);
    expect(
      filterDeliveries(deliveries, { query: '행복꽃집' }).map((d) => d.id),
    ).toEqual(['d1']);
  });

  test('matches a date fragment and a phone tail', () => {
    expect(filterDeliveries(deliveries, { query: '07-10' }).map((d) => d.id)).toEqual([
      'd1',
      'd3',
    ]);
    expect(filterDeliveries(deliveries, { query: '3334' }).map((d) => d.id)).toEqual([
      'd2',
    ]);
  });

  test('combines status and query', () => {
    expect(
      filterDeliveries(deliveries, { status: 'pending', query: '화환' }).map(
        (d) => d.id,
      ),
    ).toEqual(['d1']);
  });

  test('trims the query and returns empty on no match', () => {
    expect(filterDeliveries(deliveries, { query: '  없는상품  ' })).toEqual([]);
  });
});

describe('sortDeliveries', () => {
  test('recent keeps the input order', () => {
    expect(sortDeliveries(deliveries, 'recent').map((d) => d.id)).toEqual([
      'd1',
      'd2',
      'd3',
    ]);
  });

  test('urgency: pending before completed, earliest deadline first, missing last', () => {
    const list: Delivery[] = [
      { ...base, id: 'done', status: 'completed', deliveryDt: '2026-07-09 08:00' },
      { ...base, id: 'late', status: 'pending', deliveryDt: '2026-07-11 09:00' },
      { ...base, id: 'soon', status: 'pending', deliveryDt: '2026-07-10 13:00' },
      { ...base, id: 'noDate', status: 'pending', deliveryDt: '' },
    ];
    expect(sortDeliveries(list, 'urgency').map((d) => d.id)).toEqual([
      'soon',
      'late',
      'noDate',
      'done',
    ]);
  });

  test('does not mutate the input array', () => {
    const input = [...deliveries];
    sortDeliveries(input, 'urgency');
    expect(input.map((d) => d.id)).toEqual(['d1', 'd2', 'd3']);
  });
});
