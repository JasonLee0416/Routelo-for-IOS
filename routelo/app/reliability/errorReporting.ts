// 경량 크래시/에러 리포팅(네이티브 SDK 없이). JS 전역 에러 + 렌더 에러(ErrorBoundary)를
// 로컬 링버퍼에 남겨 진단·안정성 지표(크래시프리 근사)에 쓴다. 필요 시 텔레메트리로 업로드.
//
// 순수 함수(buildErrorRecord/pushBounded)만 임포트해도 네이티브 모듈이 로드되지 않도록
// AsyncStorage는 저장이 실제로 필요한 시점에만 지연 로드한다.
type AsyncStoreLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};
function store(): AsyncStoreLike {
  return require('@react-native-async-storage/async-storage').default;
}

export type ErrorRecord = {
  ts: number;
  message: string;
  stack?: string;
  fatal: boolean;
};

const KEY = 'routelo.errorLog.v1';
const MAX = 50;

export function buildErrorRecord(
  error: unknown,
  fatal: boolean,
  nowMs: number,
): ErrorRecord {
  const e = error as { message?: unknown; stack?: unknown };
  const message =
    typeof e?.message === 'string' ? e.message : String(error ?? 'unknown');
  return {
    ts: nowMs,
    fatal,
    message: message.slice(0, 500),
    stack: typeof e?.stack === 'string' ? e.stack.slice(0, 2000) : undefined,
  };
}

export function pushBounded<T>(list: T[], item: T, max: number): T[] {
  const next = [...list, item];
  return next.length > max ? next.slice(next.length - max) : next;
}

export async function loadErrors(): Promise<ErrorRecord[]> {
  const raw = await store().getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function recordError(error: unknown, fatal: boolean): Promise<void> {
  try {
    const rec = buildErrorRecord(error, fatal, Date.now());
    const next = pushBounded(await loadErrors(), rec, MAX);
    await store().setItem(KEY, JSON.stringify(next));
  } catch {
    // 리포팅 자체가 앱을 막아서는 안 된다.
  }
}

let installed = false;
// 앱 부팅 시 1회 호출: JS 전역 에러 핸들러를 감싸 기존 동작 유지 + 로컬 기록.
export function installGlobalErrorHandler(): void {
  if (installed) return;
  installed = true;
  const g = globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
      setGlobalHandler?: (
        h: (error: unknown, isFatal?: boolean) => void,
      ) => void;
    };
  };
  const eu = g.ErrorUtils;
  if (!eu?.setGlobalHandler || !eu?.getGlobalHandler) return;
  const prev = eu.getGlobalHandler();
  eu.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    void recordError(error, !!isFatal);
    prev?.(error, isFatal);
  });
}
