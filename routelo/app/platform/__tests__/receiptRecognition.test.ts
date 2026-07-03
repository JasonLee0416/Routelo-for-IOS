import { receiptRecognitionCapability } from '../receiptRecognition';
import {
  CLOUD_FALLBACK_CONSENT_COPY,
  CLOUD_FALLBACK_CONSENT_NOTICE_VERSION,
  RECEIPT_RECOGNITION_NOTICE,
  appleVisionRecognizer,
  clovaRecognizer,
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

describe('iOS OCR consent boundary', () => {
  test('keeps Apple Vision as an explicit native placeholder until the bridge exists', async () => {
    await expect(appleVisionRecognizer.recognize('file://receipt.jpg')).rejects.toThrow(
      'Apple Vision OCR native bridge is not connected yet',
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
