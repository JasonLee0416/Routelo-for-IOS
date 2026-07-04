import {
  IOS_INTERIM_PPOCR_FALLBACK,
  receiptRecognitionCapability,
  recognizeReceipt,
} from '../receiptRecognition';
import {
  CLOUD_FALLBACK_CONSENT_COPY,
  CLOUD_FALLBACK_CONSENT_NOTICE_VERSION,
  RECEIPT_RECOGNITION_NOTICE,
  appleVisionRecognizer,
  clovaRecognizer,
  ppocrRecognizer,
  recognizersForPlatform,
} from '../receiptRecognizers';

describe('receiptRecognitionCapability', () => {
  test('uses the same pinned PP-OCR model on Android', () => {
    expect(receiptRecognitionCapability('android')).toEqual({
      available: true,
      engine: 'ppocrv5',
      modelVersion: 'rapidocr-v3.8.0-ppocrv5',
      priority: ['ppocrv5', 'clova'],
    });
  });

  test('keeps Apple Vision first on iOS with PP-OCR as the interim fallback', () => {
    expect(receiptRecognitionCapability('ios')).toEqual({
      available: true,
      engine: 'apple-vision',
      modelVersion: 'rapidocr-v3.8.0-ppocrv5',
      priority: ['apple-vision', 'clova', 'ppocrv5'],
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

describe('iOS OCR consent boundary', () => {
  test('falls back cleanly when the Apple Vision native module is unavailable (non-iOS runtime)', async () => {
    // In Jest/non-iOS there is no linked native binary, so the recognizer must
    // reject with a clear unavailability error and let the chain move on —
    // never fabricate OCR output.
    await expect(appleVisionRecognizer.recognize('file://receipt.jpg')).rejects.toThrow(
      'Apple Vision OCR native module is unavailable',
    );
  });

  test('requires explicit cloud fallback consent before CLOVA configuration is checked', async () => {
    await expect(clovaRecognizer.recognize('file://receipt.jpg')).rejects.toThrow(
      'explicit user consent',
    );
  });

  test('requires the current consent notice version for CLOVA fallback', async () => {
    await expect(
      clovaRecognizer.recognize('file://receipt.jpg', {
        allowCloudFallback: true,
      }),
    ).rejects.toThrow('current consent notice version');
  });

  test('keeps CLOVA adapter disabled even after consent until endpoint secrets are configured', async () => {
    await expect(
      clovaRecognizer.recognize('file://receipt.jpg', {
        allowCloudFallback: true,
        cloudFallbackConsentNoticeVersion:
          CLOUD_FALLBACK_CONSENT_NOTICE_VERSION,
      }),
    ).rejects.toThrow('endpoint and secret are not configured');
  });

  test('exports consent copy for the future UI gate', () => {
    expect(CLOUD_FALLBACK_CONSENT_COPY.title).toBeTruthy();
    expect(CLOUD_FALLBACK_CONSENT_COPY.body).toContain('upload receipt evidence');
    expect(CLOUD_FALLBACK_CONSENT_COPY.confirmLabel).toBeTruthy();
  });
});

describe('iOS interim PP-OCR fallback (walking skeleton)', () => {
  test('capability advertises PP-OCR as the interim iOS fallback', () => {
    expect(IOS_INTERIM_PPOCR_FALLBACK).toBe(true);
    expect(receiptRecognitionCapability('ios').priority).toEqual([
      'apple-vision',
      'clova',
      'ppocrv5',
    ]);
  });

  test('recognizeReceipt falls through Apple Vision and CLOVA to PP-OCR on iOS', async () => {
    const ppocrResult = {
      engine: 'ppocrv5' as const,
      modelVersion: 'rapidocr-v3.8.0-ppocrv5',
      fullText: '테스트 라인',
      lines: [{ text: '테스트 라인', confidence: 0.9 }],
      processingMs: 3,
    };
    const spy = jest
      .spyOn(ppocrRecognizer, 'recognize')
      .mockResolvedValue(ppocrResult);
    try {
      const result = await recognizeReceipt('file://receipt.jpg', undefined, 'ios');
      expect(result.engine).toBe('ppocrv5');
      expect(spy).toHaveBeenCalledWith('file://receipt.jpg', undefined);
    } finally {
      spy.mockRestore();
    }
  });

  test('does not reach PP-OCR when a consented CLOVA path succeeds first', async () => {
    const clovaResult = {
      engine: 'clova' as const,
      fullText: 'clova 결과',
      lines: [{ text: 'clova 결과', confidence: 0.95 }],
      processingMs: 12,
    };
    const clovaSpy = jest
      .spyOn(clovaRecognizer, 'recognize')
      .mockResolvedValue(clovaResult);
    const ppocrSpy = jest.spyOn(ppocrRecognizer, 'recognize');
    try {
      const result = await recognizeReceipt('file://receipt.jpg', undefined, 'ios');
      expect(result.engine).toBe('clova');
      expect(ppocrSpy).not.toHaveBeenCalled();
    } finally {
      clovaSpy.mockRestore();
      ppocrSpy.mockRestore();
    }
  });
});
