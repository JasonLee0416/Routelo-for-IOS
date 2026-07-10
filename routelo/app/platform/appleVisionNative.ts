import { NativeModules } from 'react-native';

import {
  AppleVisionUnavailableError,
  type VisionPayload,
} from './appleVision';

type AppleVisionOcrNativeModule = {
  recognizeText(uri: string): Promise<VisionPayload>;
};

// NativeModules lookup is undefined when the native binary is absent — e.g.
// Android, Jest, or an iOS build made before this module was linked. Callers
// must handle unavailability via the fallback chain.
const nativeModule: AppleVisionOcrNativeModule | null =
  NativeModules.AppleVisionOcr ?? null;

export function isAppleVisionAvailable(): boolean {
  return nativeModule != null;
}

export async function recognizeTextNative(
  uri: string,
): Promise<VisionPayload> {
  if (!nativeModule) throw new AppleVisionUnavailableError();
  return nativeModule.recognizeText(uri);
}
