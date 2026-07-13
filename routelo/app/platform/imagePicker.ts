import {
  launchCamera,
  launchImageLibrary,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import { PERMISSIONS, request, RESULTS } from 'react-native-permissions';

// expo-image-picker 호환 서피스(앱이 쓰던 부분만). 카메라 권한은
// react-native-permissions로 명시 요청하고, 사진 보관함은 PHPicker 기반이라
// 별도 권한이 필요 없다. allowsEditing(시스템 크롭 UI)은 bare RN 피커가
// 지원하지 않아 원본을 그대로 반환한다.

export type ImagePickerOptions = {
  mediaTypes: ['images'];
  quality: number;
  allowsEditing: boolean;
};

export type ImagePickerAsset = {
  uri: string;
  width: number;
  height: number;
  fileSize?: number;
};

export type ImagePickerResult =
  | { canceled: true; assets?: undefined }
  | { canceled: false; assets: [ImagePickerAsset] };

export async function requestCameraPermissionsAsync(): Promise<{
  granted: boolean;
}> {
  const status = await request(PERMISSIONS.IOS.CAMERA);
  return { granted: status === RESULTS.GRANTED || status === RESULTS.LIMITED };
}

export async function requestMediaLibraryPermissionsAsync(): Promise<{
  granted: boolean;
}> {
  // PHPickerViewController runs out of process and needs no permission.
  return { granted: true };
}

function toResult(response: ImagePickerResponse): ImagePickerResult {
  const asset = response.assets?.[0];
  if (response.didCancel || response.errorCode || !asset?.uri) {
    return { canceled: true };
  }
  return {
    canceled: false,
    assets: [
      {
        uri: asset.uri,
        width: asset.width ?? 0,
        height: asset.height ?? 0,
        fileSize: asset.fileSize,
      },
    ],
  };
}

export async function launchCameraAsync(
  options: ImagePickerOptions,
): Promise<ImagePickerResult> {
  return toResult(
    await launchCamera({
      mediaType: 'photo',
      quality: options.quality as 0 | 0.6 | 1,
      saveToPhotos: false,
    }),
  );
}

export async function launchImageLibraryAsync(
  options: ImagePickerOptions,
): Promise<ImagePickerResult> {
  return toResult(
    await launchImageLibrary({
      mediaType: 'photo',
      quality: options.quality as 0 | 0.6 | 1,
      selectionLimit: 1,
    }),
  );
}
