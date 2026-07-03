import { Platform } from 'react-native';

import { PP_OCR_MODEL_VERSION } from '../ocr/ppocr/modelManifest';
import type { PpOcrLine } from '../ocr/ppocr/types';

export type ReceiptRecognizerEngine = 'apple-vision' | 'ppocrv5' | 'clova';

export type ReceiptRecognizerLine = {
  text: string;
  confidence?: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  cornerPoints?: Array<{ x: number; y: number }>;
};

export type ReceiptRecognizerResult = {
  engine: ReceiptRecognizerEngine;
  modelVersion?: string;
  fullText: string;
  lines: ReceiptRecognizerLine[];
  processingMs: number;
};

export type ReceiptRecognizerContext = {
  allowCloudFallback?: boolean;
  cloudFallbackConsentNoticeVersion?: string;
  clovaEndpoint?: string;
  clovaSecret?: string;
};

export type ReceiptRecognizer = {
  id: string;
  engine: ReceiptRecognizerEngine;
  platforms: Array<typeof Platform.OS>;
  priority: number;
  recognize(
    imageUri: string,
    context?: ReceiptRecognizerContext,
  ): Promise<ReceiptRecognizerResult>;
};

const ensureImageUri = (imageUri: string) => {
  if (!imageUri.trim()) {
    throw new Error('A captured receipt image URI is required.');
  }
};

export const CLOUD_FALLBACK_CONSENT_NOTICE_VERSION =
  '2026-07-02.clova-consent.v1';

export const CLOUD_FALLBACK_CONSENT_COPY = {
  title: 'Cloud OCR fallback',
  body:
    'CLOVA OCR can retry low-confidence receipts only after you agree to upload receipt evidence for recognition.',
  confirmLabel: 'Allow CLOVA fallback',
};

const toGenericLine = (line: PpOcrLine): ReceiptRecognizerLine => ({
  text: line.text,
  confidence: line.confidence,
  boundingBox: line.boundingBox,
  cornerPoints: line.cornerPoints,
});

export const ppocrRecognizer: ReceiptRecognizer = {
  id: 'ppocr-shared',
  engine: 'ppocrv5',
  platforms: ['android', 'ios'],
  priority: 30,
  async recognize(imageUri) {
    ensureImageUri(imageUri);
    const { recognizeReceiptWithPpOcr } = await import('../ocr/ppocr/runtime');
    const result = await recognizeReceiptWithPpOcr(imageUri);
    return {
      engine: 'ppocrv5',
      modelVersion: result.modelVersion,
      fullText: result.fullText,
      lines: result.lines.map(toGenericLine),
      processingMs: result.processingMs,
    };
  },
};

export const appleVisionRecognizer: ReceiptRecognizer = {
  id: 'apple-vision',
  engine: 'apple-vision',
  platforms: ['ios'],
  priority: 10,
  async recognize(imageUri) {
    ensureImageUri(imageUri);
    throw new Error(
      'Apple Vision OCR native bridge is not connected yet. Route to CLOVA fallback or manual input.',
    );
  },
};

export const clovaRecognizer: ReceiptRecognizer = {
  id: 'clova-consented-fallback',
  engine: 'clova',
  platforms: ['android', 'ios'],
  priority: 20,
  async recognize(imageUri, context) {
    ensureImageUri(imageUri);
    if (!context?.allowCloudFallback) {
      throw new Error('CLOVA OCR fallback requires explicit user consent.');
    }
    if (
      context.cloudFallbackConsentNoticeVersion !==
      CLOUD_FALLBACK_CONSENT_NOTICE_VERSION
    ) {
      throw new Error(
        'CLOVA OCR fallback requires the current consent notice version.',
      );
    }
    if (!context.clovaEndpoint || !context.clovaSecret) {
      throw new Error('CLOVA OCR endpoint and secret are not configured.');
    }
    throw new Error('CLOVA OCR HTTP adapter is not implemented yet.');
  },
};

export const RECEIPT_RECOGNIZERS = [
  appleVisionRecognizer,
  clovaRecognizer,
  ppocrRecognizer,
] as const;

export function recognizersForPlatform(
  platform: typeof Platform.OS,
  options: { includeSharedPpOcrOnIos?: boolean } = {},
) {
  if (platform === 'ios') {
    const recognizers: ReceiptRecognizer[] = [
      appleVisionRecognizer,
      clovaRecognizer,
    ];
    if (options.includeSharedPpOcrOnIos) recognizers.push(ppocrRecognizer);
    return recognizers.sort((left, right) => left.priority - right.priority);
  }
  if (platform === 'android') {
    return [ppocrRecognizer, clovaRecognizer];
  }
  return [];
}

export const RECEIPT_RECOGNITION_NOTICE =
  'iOS default OCR priority is Apple Vision OCR, then user-consented CLOVA OCR, then manual input. Shared PP-OCRv5 remains available as a common candidate but is not the default iOS path.';
