import type { PpOcrResult } from './types';

export function ppOcrCapability() {
  return {
    available: false,
    engine: 'ppocrv5' as const,
    modelVersion: 'rapidocr-v3.8.0-ppocrv5',
    reason: 'PP-OCR requires an Android or iOS native build.',
  };
}

export async function recognizeReceiptWithPpOcr(
  _imageUri: string,
): Promise<PpOcrResult> {
  throw new Error('PP-OCR requires an Android or iOS native build.');
}
