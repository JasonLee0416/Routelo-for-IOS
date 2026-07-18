import {
  initialLockoutState,
  isLockedOut,
  LOCKOUT_POLICY,
  normalizeLockoutState,
  registerFailure,
  registerSuccess,
  remainingLockMs,
} from '../lockout';

const T0 = 1_000_000;

describe('lockout policy', () => {
  it('allows the first freeAttempts failures with no lock', () => {
    let state = initialLockoutState();
    for (let i = 0; i < LOCKOUT_POLICY.freeAttempts; i++) {
      state = registerFailure(state, T0);
      expect(state.lockedUntil).toBeNull();
      expect(isLockedOut(state, T0)).toBe(false);
    }
    expect(state.failedCount).toBe(LOCKOUT_POLICY.freeAttempts);
  });

  it('locks with exponential delay after the free attempts', () => {
    let state = initialLockoutState();
    for (let i = 0; i < LOCKOUT_POLICY.freeAttempts; i++) {
      state = registerFailure(state, T0);
    }
    // 6번째 실패 → baseDelay
    state = registerFailure(state, T0);
    expect(state.lockedUntil).toBe(T0 + LOCKOUT_POLICY.baseDelayMs);
    expect(isLockedOut(state, T0)).toBe(true);
    expect(isLockedOut(state, T0 + LOCKOUT_POLICY.baseDelayMs)).toBe(false);

    // 7번째 실패 → baseDelay * 2
    state = registerFailure(state, T0);
    expect(state.lockedUntil).toBe(T0 + LOCKOUT_POLICY.baseDelayMs * 2);

    // 8번째 실패 → baseDelay * 4
    state = registerFailure(state, T0);
    expect(state.lockedUntil).toBe(T0 + LOCKOUT_POLICY.baseDelayMs * 4);
  });

  it('caps the delay at maxDelayMs', () => {
    let state = { failedCount: 40, lockedUntil: null as number | null };
    state = registerFailure(state, T0);
    expect(state.lockedUntil).toBe(T0 + LOCKOUT_POLICY.maxDelayMs);
  });

  it('reports remaining lock time', () => {
    const state = { failedCount: 6, lockedUntil: T0 + 30_000 };
    expect(remainingLockMs(state, T0)).toBe(30_000);
    expect(remainingLockMs(state, T0 + 10_000)).toBe(20_000);
    expect(remainingLockMs(state, T0 + 40_000)).toBe(0);
  });

  it('resets fully on success', () => {
    expect(registerSuccess()).toEqual({ failedCount: 0, lockedUntil: null });
  });

  it('normalizes untrusted stored values', () => {
    expect(normalizeLockoutState(null)).toEqual(initialLockoutState());
    expect(normalizeLockoutState({ failedCount: -3, lockedUntil: 'x' })).toEqual({
      failedCount: 0,
      lockedUntil: null,
    });
    expect(
      normalizeLockoutState({ failedCount: 7.9, lockedUntil: 123 }),
    ).toEqual({ failedCount: 7, lockedUntil: 123 });
  });
});
