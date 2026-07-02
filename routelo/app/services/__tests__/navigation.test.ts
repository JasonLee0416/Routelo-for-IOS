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

describe('navigation handoff', () => {
  let openUrlSpy: jest.SpiedFunction<typeof Linking.openURL>;

  beforeEach(() => {
    openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });

  afterEach(() => {
    openUrlSpy.mockRestore();
  });

  it('exposes readable navigation-app labels', () => {
    expect(NAV_APP_LABEL).toEqual({
      tmap: '티맵',
      kakao: '카카오맵',
      naver: '네이버지도',
    });
  });

  it('builds native deep links for supported map apps', () => {
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

  it('builds web fallbacks when a native handoff cannot be used', () => {
    const encoded = encodeURIComponent(target.name);

    expect(navWebFallback('kakao', target)).toBe(
      `https://map.kakao.com/link/to/${encoded},37.4979,127.0276`,
    );
    expect(navWebFallback('naver', target)).toBe(
      `https://map.naver.com/p/search/${encoded}`,
    );
    expect(navWebFallback('tmap', target)).toBe(
      `https://map.naver.com/p/search/${encoded}`,
    );
  });

  it('falls back to web search when the native app link fails', async () => {
    openUrlSpy
      .mockRejectedValueOnce(new Error('not installed'))
      .mockResolvedValueOnce(undefined);

    await openNavigation('tmap', target);

    expect(openUrlSpy).toHaveBeenNthCalledWith(
      1,
      navDeepLink('tmap', target),
    );
    expect(openUrlSpy).toHaveBeenNthCalledWith(
      2,
      navWebFallback('tmap', target),
    );
  });

  it('uses the fallback directly when coordinates are missing', async () => {
    await openNavigation('naver', {
      name: target.name,
      latitude: 0,
      longitude: 0,
    });

    expect(openUrlSpy).toHaveBeenCalledTimes(1);
    expect(openUrlSpy).toHaveBeenCalledWith(
      navWebFallback('naver', target),
    );
  });
});
