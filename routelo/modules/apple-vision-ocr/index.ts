import { requireOptionalNativeModule } from 'expo-modules-core';

import {
  AppleVisionUnavailableError,
  type VisionPayload,
} from '../../app/platform/appleVision';

type AppleVisionOcrNativeModule = {
  recognizeText(uri: string): Promise<VisionPayload>;
};

// requireOptionalNativeModule returns null (instead of throwing) when the native
// binary is absent — e.g. Android, web, Jest, or an iOS build made before this
// module was linked. Callers must handle unavailability via the fallback chain.
const nativeModule = requireOptionalNativeModule<AppleVisionOcrNativeModule>(
  'AppleVisionOcr',
);

export function isAppleVisionAvailable(): boolean {
  return nativeModule != null;
}

export async function recognizeTextNative(
  uri: string,
): Promise<VisionPayload> {
  if (!nativeModule) throw new AppleVisionUnavailableError();
  return nativeModule.recognizeText(uri);
}
