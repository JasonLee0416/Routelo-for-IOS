import { Platform } from 'react-native';

import {
  PP_OCR_MODEL_VERSION,
} from '../ocr/ppocr/modelManifest';
import {
  ReceiptRecognizerContext,
  ReceiptRecognizerEngine,
  ReceiptRecognizerResult,
  recognizersForPlatform,
} from './receiptRecognizers';

export type ReceiptRecognitionResult = ReceiptRecognizerResult;

export type ReceiptRecognitionCapability = {
  available: boolean;
  engine: ReceiptRecognizerEngine;
  modelVersion: string;
  priority: string[];
  reason?: string;
};

// Walking-skeleton product decision: until the native Apple Vision bridge and
// the CLOVA HTTP adapter ship, the shared on-device PP-OCRv5 recognizer runs as
// the interim iOS fallback after Apple Vision and consented CLOVA fail, before
// manual input. Flip to false once Apple Vision is the working primary path.
// The recognizer contract default (recognizersForPlatform without options) stays
// Apple Vision -> CLOVA; this toggle only affects the active execution chain.
export const IOS_INTERIM_PPOCR_FALLBACK = true;

function activeRecognizers(platform: typeof Platform.OS) {
  return recognizersForPlatform(platform, {
    includeSharedPpOcrOnIos: IOS_INTERIM_PPOCR_FALLBACK,
  });
}

export function receiptRecognitionCapability(
  platform: typeof Platform.OS,
): ReceiptRecognitionCapability {
  if (platform === 'android' || platform === 'ios') {
    const recognizers = activeRecognizers(platform);
    return {
      available: true,
      engine: recognizers[0]?.engine || 'ppocrv5',
      modelVersion: PP_OCR_MODEL_VERSION,
      priority: recognizers.map((recognizer) => recognizer.engine),
    };
  }
  return {
    available: false,
    engine: 'ppocrv5',
    modelVersion: PP_OCR_MODEL_VERSION,
    priority: [],
    reason: `Receipt recognition is unavailable on ${platform}.`,
  };
}

export async function recognizeReceipt(
  imageUri: string,
  context?: ReceiptRecognizerContext,
  platform: typeof Platform.OS = Platform.OS,
): Promise<ReceiptRecognitionResult> {
  if (!imageUri.trim()) {
    throw new Error('A captured receipt image URI is required.');
  }

  const capability = receiptRecognitionCapability(platform);
  if (!capability.available) {
    throw new Error(capability.reason);
  }

  const errors: string[] = [];
  for (const recognizer of activeRecognizers(platform)) {
    try {
      return await recognizer.recognize(imageUri, context);
    } catch (error) {
      errors.push(
        `${recognizer.engine}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  throw new Error(
    `Receipt recognition failed. Manual input is required. Attempts: ${errors.join(' | ')}`,
  );
}
