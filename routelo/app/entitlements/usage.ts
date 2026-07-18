// 무료 티어 한도 계산용 "오늘 스캔 횟수" 카운터. 날짜가 바뀌면 0으로 리셋된다.
// 저장소·시계를 주입받아 순수하게 테스트 가능.

export interface KVStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const KEY = 'routelo.scanUsage.v1';

type Usage = { date: string; count: number };

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD (로컬 자정 경계는 근사)
}

export async function getTodayScanCount(
  store: KVStore,
  now: Date,
): Promise<number> {
  const raw = await store.getItem(KEY);
  if (!raw) return 0;
  try {
    const u = JSON.parse(raw) as Usage;
    return u.date === dayKey(now) ? u.count : 0;
  } catch {
    return 0;
  }
}

export async function incrementScanCount(
  store: KVStore,
  now: Date,
): Promise<number> {
  const current = await getTodayScanCount(store, now);
  const next = current + 1;
  await store.setItem(KEY, JSON.stringify({ date: dayKey(now), count: next }));
  return next;
}
