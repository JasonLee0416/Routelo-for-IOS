import { TelemetryEvent } from './schema';

// 오프라인/실패에도 유실 없이 쌓아두는 KV 백업 큐. 저장소는 주입(테스트 용이).
export interface KVStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const DEFAULT_KEY = 'routelo.telemetry.queue.v1';
const MAX_EVENTS = 500; // 상한 — 초과 시 가장 오래된 것부터 버린다.

export class TelemetryQueue {
  constructor(
    private readonly store: KVStore,
    private readonly key: string = DEFAULT_KEY,
  ) {}

  async load(): Promise<TelemetryEvent[]> {
    const raw = await this.store.getItem(this.key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async enqueue(events: TelemetryEvent[]): Promise<void> {
    if (!events.length) return;
    const merged = [...(await this.load()), ...events];
    const trimmed =
      merged.length > MAX_EVENTS ? merged.slice(merged.length - MAX_EVENTS) : merged;
    await this.store.setItem(this.key, JSON.stringify(trimmed));
  }

  async peek(n: number): Promise<TelemetryEvent[]> {
    return (await this.load()).slice(0, n);
  }

  // 서버가 확인한(2xx) 이벤트 id를 제거. 부분 성공도 안전하게 반영된다.
  async ack(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const drop = new Set(ids);
    const rest = (await this.load()).filter((e) => !drop.has(e.id));
    await this.store.setItem(this.key, JSON.stringify(rest));
  }

  async size(): Promise<number> {
    return (await this.load()).length;
  }
}
