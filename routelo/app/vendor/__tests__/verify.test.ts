import {
  createKakaoVendorDirectory,
  NULL_VENDOR_DIRECTORY,
  resolveVendorDirectory,
} from '../kakao';
import { VendorCandidate, VendorDirectory } from '../types';
import { nameSimilarity, phonesMatch, verifyVendor } from '../verify';

const mockDirectory = (candidates: VendorCandidate[]): VendorDirectory => ({
  id: 'mock',
  async search() {
    return candidates;
  },
});

describe('vendor matching helpers', () => {
  it('name similarity: high for near-identical, low for unrelated', () => {
    expect(nameSimilarity('선유꽃화원', '선유꽃 화원')).toBeGreaterThan(0.9);
    expect(nameSimilarity('타임플라워', '에덴화원')).toBeLessThan(0.4);
  });

  it('phone match ignores formatting and needs full match', () => {
    expect(phonesMatch('010-5898-9543', '01058989543')).toBe(true);
    expect(phonesMatch('010-5898-9543', '02-841-9861')).toBe(false);
    expect(phonesMatch(undefined, '0105')).toBe(false);
  });
});

describe('verifyVendor', () => {
  it('confirms on phone match even with a noisy name', async () => {
    const dir = mockDirectory([
      { name: '타임플라워 의정부점', phone: '010-5898-9543' },
      { name: '다른 꽃집', phone: '02-111-2222' },
    ]);
    const v = await verifyVendor(dir, '타임플라', { ocrPhone: '010 5898 9543' });
    expect(v.status).toBe('confirmed');
    expect(v.phoneMatched).toBe(true);
    expect(v.best?.name).toBe('타임플라워 의정부점');
  });

  it('confirms on a strong name match without phone', async () => {
    const dir = mockDirectory([{ name: '선유꽃화원', address: '서울 영등포구' }]);
    const v = await verifyVendor(dir, '선유꽃화원');
    expect(v.status).toBe('confirmed');
    expect(v.phoneMatched).toBe(false);
  });

  it('returns ambiguous candidates for a weak match', async () => {
    const dir = mockDirectory([{ name: '플라워하우스' }, { name: '플라워가든' }]);
    const v = await verifyVendor(dir, '플라워');
    expect(v.status).toBe('ambiguous');
    expect(v.candidates).toHaveLength(2);
  });

  it('notFound when search returns nothing', async () => {
    const v = await verifyVendor(mockDirectory([]), '없는화원');
    expect(v.status).toBe('notFound');
  });

  it('skips when directory is the null fallback (no key / offline)', async () => {
    const v = await verifyVendor(NULL_VENDOR_DIRECTORY, '선유꽃화원');
    expect(v.status).toBe('skipped');
  });
});

describe('provider resolution and request shape', () => {
  it('resolveVendorDirectory returns null fallback without a key', () => {
    expect(resolveVendorDirectory().id).toBe('null');
    expect(resolveVendorDirectory({ kakaoRestApiKey: '' }).id).toBe('null');
    expect(resolveVendorDirectory({ kakaoRestApiKey: 'abc' }).id).toBe(
      'kakao-local',
    );
  });

  it('kakao provider sends only the query + KakaoAK auth (no PII)', async () => {
    let sentUrl = '';
    let sentAuth = '';
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      sentUrl = String(url);
      sentAuth = String((init?.headers as Record<string, string>)?.Authorization);
      return {
        ok: true,
        json: async () => ({
          documents: [
            { place_name: '선유꽃화원', phone: '02-1234-5678', x: '126.9', y: '37.5' },
          ],
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const dir = createKakaoVendorDirectory({ restApiKey: 'KEY', fetchImpl });
    const res = await dir.search('선유꽃화원');

    expect(sentUrl).toContain('keyword.json');
    expect(sentUrl).toContain(encodeURIComponent('선유꽃화원'));
    expect(sentAuth).toBe('KakaoAK KEY');
    // 질의에 개인정보가 섞이지 않았는지 확인(업체명만)
    expect(sentUrl).not.toMatch(/01[016789]/);
    expect(res[0].name).toBe('선유꽃화원');
    expect(res[0].latitude).toBeCloseTo(37.5);
    expect(res[0].longitude).toBeCloseTo(126.9);
  });
});
