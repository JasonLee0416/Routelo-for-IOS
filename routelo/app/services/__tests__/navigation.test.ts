import { Linking } from 'react-native';

import {
  NAV_APP_LABEL,
  navDeepLink,
  navWebFallback,
  openNavigation,
} from '../navigation';

const target = {
  name: '강남 행사장',
  latitude: 37.4979,
  longitude: 127.0276,
};

const noCoords = { name: '강남 행사장', latitude: 0, longitude: 0 };

describe('navigation handoff', () => {
  let openUrlSpy: jest.SpiedFunction<typeof Linking.openURL>;
  let canOpenSpy: jest.SpiedFunction<typeof Linking.canOpenURL>;

  beforeEach(() => {
    openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    canOpenSpy = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
  });

  afterEach(() => {
    openUrlSpy.mockRestore();
    canOpenSpy.mockRestore();
  });

  it('exposes readable navigation-app labels', () => {
    expect(NAV_APP_LABEL).toEqual({
      tmap: '티맵',
      kakao: '카카오맵',
      naver: '네이버지도',
    });
  });

  it('builds route deep links per app when coordinates are known', () => {
    const encoded = encodeURIComponent(target.name);

    expect(navDeepLink('tmap', target)).toBe(
      `tmap://route?goalname=${encoded}&goalx=127.0276&goaly=37.4979`,
    );
    expect(navDeepLink('kakao', target)).toBe(
      'kakaomap://route?ep=37.4979,127.0276&by=CAR',
    );
    expect(navDeepLink('naver', target)).toBe(
      `nmap://route/car?dlat=37.4979&dlng=127.0276&dname=${encoded}&appname=com.jasonlee0312.routelo`,
    );
  });

  it('builds address-search deep links into the SAME app when coordinates are missing', () => {
    const encoded = encodeURIComponent(noCoords.name);

    // Every app opens its own app — no silent switch to another map service.
    expect(navDeepLink('tmap', noCoords)).toBe(`tmap://search?name=${encoded}`);
    expect(navDeepLink('kakao', noCoords)).toBe(`kakaomap://search?q=${encoded}`);
    expect(navDeepLink('naver', noCoords)).toBe(
      `nmap://search?query=${encoded}&appname=com.jasonlee0312.routelo`,
    );
  });

  it('keeps web fallbacks in-brand (tmap no longer routes to naver)', () => {
    const encoded = encodeURIComponent(target.name);

    expect(navWebFallback('tmap', target)).toBe(
      'https://apps.apple.com/kr/app/id431589174',
    );
    expect(navWebFallback('kakao', target)).toBe(
      `https://map.kakao.com/link/to/${encoded},37.4979,127.0276`,
    );
    expect(navWebFallback('kakao', noCoords)).toBe(
      `https://map.kakao.com/link/search/${encoded}`,
    );
    expect(navWebFallback('naver', target)).toBe(
      `https://map.naver.com/p/search/${encoded}`,
    );
  });

  it('opens the selected app when it is installed', async () => {
    await openNavigation('tmap', target);

    expect(canOpenSpy).toHaveBeenCalledWith(navDeepLink('tmap', target));
    expect(openUrlSpy).toHaveBeenCalledTimes(1);
    expect(openUrlSpy).toHaveBeenCalledWith(navDeepLink('tmap', target));
  });

  it('falls back to the in-brand web link when the app is not installed', async () => {
    canOpenSpy.mockResolvedValue(false);

    await openNavigation('tmap', target);

    expect(openUrlSpy).toHaveBeenCalledTimes(1);
    expect(openUrlSpy).toHaveBeenCalledWith(navWebFallback('tmap', target));
  });

  it('opens each chosen app distinctly even without coordinates', async () => {
    await openNavigation('kakao', noCoords);
    expect(openUrlSpy).toHaveBeenLastCalledWith('kakaomap://search?q=' + encodeURIComponent(noCoords.name));

    await openNavigation('naver', noCoords);
    expect(openUrlSpy).toHaveBeenLastCalledWith(
      `nmap://search?query=${encodeURIComponent(noCoords.name)}&appname=com.jasonlee0312.routelo`,
    );
  });
});
