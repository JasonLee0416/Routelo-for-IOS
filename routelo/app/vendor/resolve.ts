import { RouteloSettings } from '../settings';
import { resolveVendorDirectory } from './kakao';
import { VendorDirectory } from './types';

// 설정 토글(옵트인) + 환경변수 키가 모두 있을 때만 실제 카카오 디렉터리를 돌려준다.
// - 토글 OFF → null 디렉터리 (교차검증 조용히 skipped)
// - 토글 ON 이지만 키 없음 → null 디렉터리 (크래시 없이 비활성)
// 키는 빌드시 주입되는 EXPO_PUBLIC_* 환경변수에서만 읽으며, 코드에 하드코딩하지 않는다.
export function vendorDirectoryFor(settings: RouteloSettings): VendorDirectory {
  if (!settings.ocr.onlineVendorVerification) {
    return resolveVendorDirectory();
  }
  return resolveVendorDirectory({
    kakaoRestApiKey: process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY,
  });
}
