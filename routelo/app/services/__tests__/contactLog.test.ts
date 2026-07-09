import { ContactLog } from '../../models';
import {
  buildContactLog,
  channelFromLabel,
  formatLocalContactTime,
  recentContactsForDelivery,
} from '../contactLog';

describe('formatLocalContactTime', () => {
  test('formats local month-day hour:minute (TZ-independent via local getters)', () => {
    // Built from local components, read back as local → no TZ assumption.
    expect(formatLocalContactTime(new Date(2026, 6, 9, 14, 5))).toBe('07-09 14:05');
    expect(formatLocalContactTime(new Date(2026, 11, 1, 0, 0))).toBe('12-01 00:00');
  });
});

describe('channelFromLabel', () => {
  test('maps known Korean labels to channels', () => {
    expect(channelFromLabel('수령인')).toBe('recipient');
    expect(channelFromLabel('발주처')).toBe('orderingVendor');
    expect(channelFromLabel('화원')).toBe('fulfillingVendor');
  });

  test('falls back to "other" for an unknown label', () => {
    expect(channelFromLabel('사장님')).toBe('other');
  });
});

describe('buildContactLog', () => {
  test('captures the call with a derived channel', () => {
    const log = buildContactLog({
      id: 'c1',
      deliveryId: 'd1',
      label: '수령인',
      phone: '01011112222',
      at: '2026-07-09T05:00:00.000Z',
    });
    expect(log).toEqual({
      id: 'c1',
      deliveryId: 'd1',
      channel: 'recipient',
      label: '수령인',
      phone: '01011112222',
      at: '2026-07-09T05:00:00.000Z',
    });
  });
});

describe('recentContactsForDelivery', () => {
  const log = (over: Partial<ContactLog>): ContactLog => ({
    id: 'x',
    deliveryId: 'd1',
    channel: 'recipient',
    label: '수령인',
    phone: '010',
    at: '2026-07-09T00:00:00.000Z',
    ...over,
  });

  test('filters by delivery and sorts most-recent-first', () => {
    const logs = [
      log({ id: 'a', at: '2026-07-09T01:00:00.000Z' }),
      log({ id: 'other', deliveryId: 'd2', at: '2026-07-09T09:00:00.000Z' }),
      log({ id: 'b', at: '2026-07-09T03:00:00.000Z' }),
    ];
    const recent = recentContactsForDelivery(logs, 'd1');
    expect(recent.map((l) => l.id)).toEqual(['b', 'a']);
  });

  test('caps the result at the limit', () => {
    const logs = Array.from({ length: 8 }, (_, i) =>
      log({ id: `c${i}`, at: `2026-07-09T0${i}:00:00.000Z` }),
    );
    expect(recentContactsForDelivery(logs, 'd1', 3)).toHaveLength(3);
  });

  test('returns empty when nothing matches', () => {
    expect(recentContactsForDelivery([log({})], 'nope')).toEqual([]);
  });
});
