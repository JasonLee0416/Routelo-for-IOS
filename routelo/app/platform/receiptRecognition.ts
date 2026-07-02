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

export function receiptRecognitionCapability(
  platform: typeof Platform.OS,
): ReceiptRecognitionCapability {
  if (platform === 'android' || platform === 'ios') {
    const recognizers = recognizersForPlatform(platform);
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
): Promise<ReceiptRecognitionResult> {
  if (!imageUri.trim()) {
    throw new Error('A captured receipt image URI is required.');
  }

  const capability = receiptRecognitionCapability(Platform.OS);
  if (!capability.available) {
    throw new Error(capability.reason);
  }

  const errors: string[] = [];
  for (const recognizer of recognizersForPlatform(Platform.OS)) {
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
