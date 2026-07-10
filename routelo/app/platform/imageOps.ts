import { NativeModules } from 'react-native';

// expo-image-manipulator 호환 서피스(앱이 쓰던 crop/resize→base64 JPEG 부분만).
// 실제 픽셀 작업은 네이티브 RouteloImageOps(ios/Routelo/RouteloImageOps.swift)가
// 수행하며 EXIF 방향을 먼저 굽는다.

export type Action =
  | { resize: { width?: number; height?: number } }
  | { crop: { originX: number; originY: number; width: number; height: number } };

export enum SaveFormat {
  JPEG = 'jpeg',
}

export type ManipulateResult = {
  base64?: string;
  width: number;
  height: number;
};

type RouteloImageOpsModule = {
  manipulate(
    uri: string,
    actions: Action[],
    compress: number,
  ): Promise<{ base64: string; width: number; height: number }>;
};

const nativeModule: RouteloImageOpsModule | undefined =
  NativeModules.RouteloImageOps;

export async function manipulateAsync(
  uri: string,
  actions: Action[],
  options: { base64?: boolean; compress?: number; format?: SaveFormat },
): Promise<ManipulateResult> {
  if (!nativeModule) {
    throw new Error('RouteloImageOps native module is unavailable.');
  }
  const result = await nativeModule.manipulate(
    uri,
    actions,
    options.compress ?? 1,
  );
  return {
    base64: options.base64 ? result.base64 : undefined,
    width: result.width,
    height: result.height,
  };
}
