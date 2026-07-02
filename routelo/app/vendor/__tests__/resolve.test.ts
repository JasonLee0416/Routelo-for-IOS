import { DEFAULT_ROUTELO_SETTINGS, RouteloSettings } from '../../settings';
import { vendorDirectoryFor } from '../resolve';

const withVerification = (on: boolean): RouteloSettings => ({
  ...DEFAULT_ROUTELO_SETTINGS,
  ocr: { ...DEFAULT_ROUTELO_SETTINGS.ocr, onlineVendorVerification: on },
});

describe('vendorDirectoryFor', () => {
  const KEY = 'EXPO_PUBLIC_KAKAO_REST_API_KEY';
  const original = process.env[KEY];

  afterEach(() => {
    if (original === undefined) delete process.env[KEY];
    else process.env[KEY] = original;
  });

  it('is disabled (null) when the toggle is OFF, even with a key', () => {
    process.env[KEY] = 'KEY';
    expect(vendorDirectoryFor(withVerification(false)).id).toBe('null');
  });

  it('is disabled (null) when ON but no key is present', () => {
    delete process.env[KEY];
    expect(vendorDirectoryFor(withVerification(true)).id).toBe('null');
  });

  it('uses the Kakao directory when ON and a key is present', () => {
    process.env[KEY] = 'KEY';
    expect(vendorDirectoryFor(withVerification(true)).id).toBe('kakao-local');
  });
});
