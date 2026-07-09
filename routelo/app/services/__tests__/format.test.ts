import { Delivery } from '../../models';
import {
  addMinutes,
  formatWon,
  isEventDelivery,
  maskAddressForList,
  priorityOf,
  timeOf,
} from '../format';

describe('formatWon', () => {
  test('rounds and adds thousands separators + 원', () => {
    expect(formatWon(51000)).toBe('51,000원');
    expect(formatWon(1234.6)).toBe('1,235원');
    expect(formatWon(0)).toBe('0원');
  });
});

describe('maskAddressForList', () => {
  test('keeps the first two tokens and masks the rest', () => {
    expect(maskAddressForList('서울 강남구 테헤란로 152')).toBe('서울 강남구 ···');
  });
  test('returns short addresses unchanged', () => {
    expect(maskAddressForList('강남구 역삼동')).toBe('강남구 역삼동');
    expect(maskAddressForList('강남구')).toBe('강남구');
  });
});

describe('timeOf', () => {
  test('takes the time part after a space, else the whole value', () => {
    expect(timeOf('2026-07-09 13:30')).toBe('13:30');
    expect(timeOf('13:30')).toBe('13:30');
  });
});

describe('addMinutes', () => {
  test('adds minutes with hour rollover and zero-padding', () => {
    expect(addMinutes('13:30', 45)).toBe('14:15');
    expect(addMinutes('09:05', 5)).toBe('09:10');
    expect(addMinutes('23:50', 20)).toBe('00:10'); // wraps past midnight
  });
});

const delivery = (over: Partial<Delivery> = {}): Delivery =>
  ({
    status: 'pending',
    productName: '장미 꽃다발',
    distanceKm: 3,
    eventTime: '',
    ...over,
  }) as Delivery;

describe('isEventDelivery / priorityOf', () => {
  test('event when eventTime set or product mentions 축하', () => {
    expect(isEventDelivery(delivery({ eventTime: '14:00' }))).toBe(true);
    expect(isEventDelivery(delivery({ productName: '축하 화환' }))).toBe(true);
    expect(isEventDelivery(delivery())).toBe(false);
  });

  test('priority: event → urgent, far → risk, else by status', () => {
    expect(priorityOf(delivery({ eventTime: '14:00' }))).toBe('urgent');
    expect(priorityOf(delivery({ distanceKm: 12 }))).toBe('risk');
    expect(priorityOf(delivery({ status: 'completed' }))).toBe('completed');
    expect(priorityOf(delivery())).toBe('normal');
  });
});
