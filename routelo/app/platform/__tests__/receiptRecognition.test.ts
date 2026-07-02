import { receiptRecognitionCapability } from '../receiptRecognition';
import { RECEIPT_RECOGNITION_NOTICE, recognizersForPlatform } from '../receiptRecognizers';

describe('receiptRecognitionCapability', () => {
  test('uses the same pinned PP-OCR model on Android', () => {
    expect(receiptRecognitionCapability('android')).toEqual({
      available: true,
      engine: 'ppocrv5',
      modelVersion: 'rapidocr-v3.8.0-ppocrv5',
      priority: ['ppocrv5', 'clova'],
    });
  });

  test('uses Apple Vision first on iOS and keeps CLOVA as consented fallback', () => {
    expect(receiptRecognitionCapability('ios')).toEqual({
      available: true,
      engine: 'apple-vision',
      modelVersion: 'rapidocr-v3.8.0-ppocrv5',
      priority: ['apple-vision', 'clova'],
    });
  });

  test('does not silently substitute OCR on web', () => {
    expect(receiptRecognitionCapability('web')).toEqual({
      available: false,
      engine: 'ppocrv5',
      modelVersion: 'rapidocr-v3.8.0-ppocrv5',
      priority: [],
      reason: 'Receipt recognition is unavailable on web.',
    });
  });

  test('documents shared PP-OCR as an optional iOS candidate without changing default priority', () => {
    expect(recognizersForPlatform('ios').map((recognizer) => recognizer.engine)).toEqual([
      'apple-vision',
      'clova',
    ]);
    expect(
      recognizersForPlatform('ios', { includeSharedPpOcrOnIos: true }).map(
        (recognizer) => recognizer.engine,
      ),
    ).toEqual(['apple-vision', 'clova', 'ppocrv5']);
    expect(RECEIPT_RECOGNITION_NOTICE).toContain('manual input');
  });
});
