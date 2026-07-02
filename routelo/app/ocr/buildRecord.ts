import { FieldDef } from './fieldRegistry';
import { normalizeReceipt } from './normalize';
import { ReceiptRecord } from './schema';

// OCR 원본 라인 → 저장용 레코드. (id는 호출부에서 Date.now 등으로 주입해 테스트 가능하게 함)
export function buildReceiptRecord(params: {
  id: string;
  capturedAt: string;
  lines: string[];
  registry: FieldDef[];
  imageUri?: string;
  registryVersion: number;
}): ReceiptRecord {
  const { fields, unmapped } = normalizeReceipt(params.lines, params.registry);
  return {
    id: params.id,
    capturedAt: params.capturedAt,
    imageUri: params.imageUri,
    raw: { lines: params.lines },
    fields,
    unmapped,
    registryVersion: params.registryVersion,
  };
}
