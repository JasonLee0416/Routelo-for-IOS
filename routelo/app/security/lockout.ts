// PIN 무차별 대입(brute-force) 방지 정책(순수 함수). 저장은 하지 않고 상태 전이만
// 계산한다. djb2 해시가 암호학적으로 약하다는 점을 감안해, 시도 횟수 제한 +
// 지수적 잠금 지연으로 온라인 추측 공격을 실질적으로 차단하는 것이 목적이다.
// (OWASP MASVS: 인증 시도 제한)

export type LockoutState = {
  failedCount: number;
  lockedUntil: number | null; // epoch ms. null이면 잠금 없음.
};

export const LOCKOUT_POLICY = {
  freeAttempts: 5, // 이 횟수까지는 지연 없이 재시도 허용
  baseDelayMs: 30_000, // 초과 첫 실패의 지연(이후 2배씩)
  maxDelayMs: 15 * 60_000, // 지연 상한 15분
};

export function initialLockoutState(): LockoutState {
  return { failedCount: 0, lockedUntil: null };
}

export function isLockedOut(state: LockoutState, now: number): boolean {
  return state.lockedUntil != null && now < state.lockedUntil;
}

export function remainingLockMs(state: LockoutState, now: number): number {
  if (state.lockedUntil == null) return 0;
  return Math.max(0, state.lockedUntil - now);
}

// 실패 1회 반영. freeAttempts 초과분마다 baseDelay×2^(초과-1)을 maxDelay 상한으로
// 적용한다. 예) free=5, base=30s → 6번째 실패=30s, 7번째=60s, 8번째=120s ...
export function registerFailure(state: LockoutState, now: number): LockoutState {
  const failedCount = state.failedCount + 1;
  const over = failedCount - LOCKOUT_POLICY.freeAttempts;
  if (over <= 0) return { failedCount, lockedUntil: null };
  const delay = Math.min(
    LOCKOUT_POLICY.maxDelayMs,
    LOCKOUT_POLICY.baseDelayMs * 2 ** (over - 1),
  );
  return { failedCount, lockedUntil: now + delay };
}

// 성공 시 완전 초기화.
export function registerSuccess(): LockoutState {
  return initialLockoutState();
}

// 저장/복원 시 신뢰할 수 없는 값 방어(정수화·null 정리).
export function normalizeLockoutState(value: unknown): LockoutState {
  if (!value || typeof value !== 'object') return initialLockoutState();
  const raw = value as Record<string, unknown>;
  const failedCount =
    typeof raw.failedCount === 'number' && raw.failedCount > 0
      ? Math.floor(raw.failedCount)
      : 0;
  const lockedUntil =
    typeof raw.lockedUntil === 'number' && Number.isFinite(raw.lockedUntil)
      ? raw.lockedUntil
      : null;
  return { failedCount, lockedUntil };
}
