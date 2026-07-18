import { OcrFieldResult, OcrPipelineResult } from '../../models';
import { buildScanEvent } from '../events';
import { isPiiField, levenshtein, redactValue, shape } from '../redact';
import { KVStore, TelemetryQueue } from '../queue';
import { TelemetryEvent } from '../schema';

describe('redact', () => {
  it('classifies PII fields', () => {
    expect(isPiiField('recipientName')).toBe(true);
    expect(isPiiField('recipientTel')).toBe(true);
    expect(isPiiField('deliveryAddress')).toBe(true);
    expect(isPiiField('productName')).toBe(false);
    expect(isPiiField('eventTime')).toBe(false);
  });

  it('shape-masks identity but keeps structure', () => {
    expect(shape('홍길동')).toBe('○○○');
    expect(shape('010-1234-5678')).toBe('NNN-NNNN-NNNN');
    expect(shape('강남구 A동 101호')).toBe('○○○ x○ NNN○');
  });

  it('redactValue keeps non-PII verbatim, masks PII', () => {
    expect(redactValue('productName', '축하3단화환')).toBe('축하3단화환');
    expect(redactValue('recipientName', '김철수')).toBe('○○○');
  });

  it('levenshtein measures edit size', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
    expect(levenshtein('0l0', '010')).toBe(1);
    expect(levenshtein('', 'abc')).toBe(3);
  });
});

function field(over: Partial<OcrFieldResult>): OcrFieldResult {
  return {
    key: 'productName',
    label: '상품',
    value: '',
    confidence: 90,
    required: false,
    sourceText: '',
    alternatives: [],
    status: 'confirmed',
    ...over,
  };
}

function pipeline(fields: OcrFieldResult[]): OcrPipelineResult {
  return {
    engine: 'apple-vision',
    modelVersion: 'v1',
    rawText: '',
    fields,
    documentConfidence: 88,
    quality: {
      score: 0.9,
      blur: 0,
      brightness: 0,
      documentCoverage: 0,
      skew: 0,
      shadow: 0,
      passed: true,
      messages: [],
    },
    processingMs: 120,
    variantsCompared: 1,
    unmapped: [],
    conflicts: [],
    cloudFallback: { trigger: false, reasons: [] },
  } as unknown as OcrPipelineResult;
}

describe('buildScanEvent', () => {
  it('captures correction pairs, redacting PII and counting changes', () => {
    const result = pipeline([
      field({ key: 'productName', rawValue: '축하3단', value: '축하3단' }),
      field({ key: 'recipientName', rawValue: '홍길동', value: '홍길순', required: true }),
    ]);
    const finalFields = [
      field({ key: 'productName', rawValue: '축하3단', value: '축하3단화환' }),
      field({ key: 'recipientName', rawValue: '홍길동', value: '홍길순', required: true }),
    ];
    const ev = buildScanEvent(result, finalFields, {
      id: 'e1',
      ts: 1000,
      deviceId: 'dev1',
      appVersion: '1.0.0',
    });

    expect(ev.engine).toBe('apple-vision');
    expect(ev.fieldCount).toBe(2);
    expect(ev.changedCount).toBe(2);

    const product = ev.corrections.find((c) => c.key === 'productName')!;
    expect(product.pii).toBe(false);
    expect(product.ocr).toBe('축하3단'); // 비-PII 원문 유지
    expect(product.final).toBe('축하3단화환');
    expect(product.changed).toBe(true);
    expect(product.editDistance).toBe(2);

    const name = ev.corrections.find((c) => c.key === 'recipientName')!;
    expect(name.pii).toBe(true);
    expect(name.ocr).toBe('○○○'); // PII 마스킹
    expect(name.final).toBe('○○○');
    expect(name.changed).toBe(true);
    expect(name.editDistance).toBe(1); // 실제 값 기준 거리(값 자체는 비노출)
  });
});

class MemStore implements KVStore {
  private map = new Map<string, string>();
  async getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  async setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

function evt(id: string): TelemetryEvent {
  return {
    schema: 1,
    type: 'ocr_scan_review',
    id,
    ts: 1,
    deviceId: 'd',
    appVersion: '1',
    engine: 'apple-vision',
    processingMs: 1,
    documentConfidence: 1,
    qualityScore: 1,
    qualityPassed: true,
    fieldCount: 0,
    changedCount: 0,
    corrections: [],
  };
}

describe('TelemetryQueue', () => {
  it('enqueues, peeks and acks by id (loss-safe)', async () => {
    const q = new TelemetryQueue(new MemStore());
    await q.enqueue([evt('a'), evt('b'), evt('c')]);
    expect(await q.size()).toBe(3);
    const batch = await q.peek(2);
    expect(batch.map((e) => e.id)).toEqual(['a', 'b']);
    await q.ack(['a']);
    expect(await q.size()).toBe(2);
    expect((await q.load()).map((e) => e.id)).toEqual(['b', 'c']);
  });
});
