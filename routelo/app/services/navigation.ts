import { Linking } from 'react-native';

import { NavApp } from '../settings';

export const NAV_APP_LABEL: Record<NavApp, string> = {
  tmap: '티맵',
  kakao: '카카오맵',
  naver: '네이버지도',
};

export type NavTarget = {
  name: string;
  latitude: number;
  longitude: number;
};

const APP_PACKAGE = 'com.jasonlee0312.routelo';

// 지오코딩 전이면 좌표가 0/미정으로 들어온다. 좌표가 있을 때만 경로 안내를,
// 없으면 목적지 주소 검색을 쓰도록 구분한다.
export function hasValidCoords(target: NavTarget): boolean {
  return (
    Number.isFinite(target.latitude) &&
    Number.isFinite(target.longitude) &&
    (target.latitude !== 0 || target.longitude !== 0)
  );
}

// 사용자가 고른 앱으로 반드시 연결되는 딥링크. 좌표가 있으면 경로 안내,
// 없으면 같은 앱의 목적지 검색 — 어느 경우든 티맵→티맵, 카카오→카카오,
// 네이버→네이버로 열린다.
export function navDeepLink(app: NavApp, target: NavTarget): string {
  const query = encodeURIComponent(target.name);
  const { latitude: lat, longitude: lng } = target;
  const coords = hasValidCoords(target);
  switch (app) {
    case 'tmap':
      return coords
        ? `tmap://route?goalname=${query}&goalx=${lng}&goaly=${lat}`
        : `tmap://search?name=${query}`;
    case 'kakao':
      return coords
        ? `kakaomap://route?ep=${lat},${lng}&by=CAR`
        : `kakaomap://search?q=${query}`;
    case 'naver':
      return coords
        ? `nmap://route/car?dlat=${lat}&dlng=${lng}&dname=${query}&appname=${APP_PACKAGE}`
        : `nmap://search?query=${query}&appname=${APP_PACKAGE}`;
  }
}

// 선택한 앱이 설치돼 있지 않을 때의 폴백. 각 앱의 자기 브랜드 웹으로 보내며,
// 웹 지도가 없는 티맵은 App Store 설치 페이지로 유도한다(경쟁 앱으로 몰래
// 바꾸지 않는다 — 이전엔 티맵 폴백이 네이버로 가는 버그가 있었다).
export function navWebFallback(app: NavApp, target: NavTarget): string {
  const query = encodeURIComponent(target.name);
  const coords = hasValidCoords(target);
  switch (app) {
    case 'tmap':
      return 'https://apps.apple.com/kr/app/id431589174';
    case 'kakao':
      return coords
        ? `https://map.kakao.com/link/to/${query},${target.latitude},${target.longitude}`
        : `https://map.kakao.com/link/search/${query}`;
    case 'naver':
      return `https://map.naver.com/p/search/${query}`;
  }
}

export async function openNavigation(
  app: NavApp,
  target: NavTarget,
): Promise<void> {
  const deepLink = navDeepLink(app, target);
  // canOpenURL로 설치 여부를 판별(Info.plist의 LSApplicationQueriesSchemes 필요).
  // 설치돼 있으면 반드시 그 앱을, 아니면 브랜드 웹 폴백을 연다.
  try {
    if (await Linking.canOpenURL(deepLink)) {
      await Linking.openURL(deepLink);
      return;
    }
  } catch {
    // canOpenURL이 실패하면 폴백으로 넘어간다.
  }
  await Linking.openURL(navWebFallback(app, target));
}
