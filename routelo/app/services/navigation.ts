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

export function navDeepLink(app: NavApp, target: NavTarget): string {
  const name = encodeURIComponent(target.name);
  const { latitude: lat, longitude: lng } = target;
  switch (app) {
    case 'tmap':
      return `tmap://route?goalname=${name}&goalx=${lng}&goaly=${lat}`;
    case 'kakao':
      return `kakaomap://route?ep=${lat},${lng}&by=CAR`;
    case 'naver':
      return `nmap://route/car?dlat=${lat}&dlng=${lng}&dname=${name}&appname=${APP_PACKAGE}`;
  }
}

export function navWebFallback(app: NavApp, target: NavTarget): string {
  const name = encodeURIComponent(target.name);
  switch (app) {
    case 'kakao':
      return `https://map.kakao.com/link/to/${name},${target.latitude},${target.longitude}`;
    case 'naver':
    case 'tmap':
      return `https://map.naver.com/p/search/${name}`;
  }
}

export async function openNavigation(
  app: NavApp,
  target: NavTarget,
): Promise<void> {
  const hasCoords =
    Number.isFinite(target.latitude) &&
    Number.isFinite(target.longitude) &&
    (target.latitude !== 0 || target.longitude !== 0);
  if (hasCoords) {
    try {
      await Linking.openURL(navDeepLink(app, target));
      return;
    } catch {
      // Fall back when the selected map app is not installed or rejects the link.
    }
  }
  await Linking.openURL(navWebFallback(app, target));
}
