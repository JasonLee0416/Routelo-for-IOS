import { normalizeMemberPlan, resolveEntitlement } from '../resolve';
import { MemberRecord } from '../schema';

const record = (plan: 'free' | 'pro'): MemberRecord => ({
  deviceId: 'd1',
  label: '호준',
  plan,
  updatedAt: '2026-07-18T00:00:00Z',
});

describe('normalizeMemberPlan', () => {
  it('accepts free/pro, falls back otherwise', () => {
    expect(normalizeMemberPlan('pro')).toBe('pro');
    expect(normalizeMemberPlan('free')).toBe('free');
    expect(normalizeMemberPlan('gold')).toBe('free'); // 기본 무료
    expect(normalizeMemberPlan(undefined, 'pro')).toBe('pro');
  });
});

describe('resolveEntitlement', () => {
  it('found → remote plan is authority (upgrade or downgrade)', () => {
    expect(resolveEntitlement({ status: 'found', record: record('pro') }, 'free')).toEqual({
      plan: 'pro',
      source: 'remote',
    });
    // 로컬이 pro여도 원격이 free면 강등된다(운영자 통제).
    expect(resolveEntitlement({ status: 'found', record: record('free') }, 'pro')).toEqual({
      plan: 'free',
      source: 'remote',
    });
  });

  it('absent → managed default (free), self-register', () => {
    expect(resolveEntitlement({ status: 'absent' }, 'pro')).toEqual({
      plan: 'free',
      source: 'self-registered',
    });
  });

  it('error → keep local (no downgrade offline)', () => {
    expect(resolveEntitlement({ status: 'error' }, 'pro')).toEqual({
      plan: 'pro',
      source: 'cache',
    });
    expect(resolveEntitlement({ status: 'error' }, 'free')).toEqual({
      plan: 'free',
      source: 'cache',
    });
  });
});
