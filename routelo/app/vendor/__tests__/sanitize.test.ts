import { sanitizeVendorQuery } from '../sanitize';
import { VendorCandidate, VendorDirectory } from '../types';
import { verifyVendor } from '../verify';

describe('sanitizeVendorQuery (provider boundary)', () => {
  it('accepts a clean business name', () => {
    expect(sanitizeVendorQuery('선유꽃화원')).toEqual({ safe: '선유꽃화원' });
    expect(sanitizeVendorQuery('  타임플라워  의정부  ')).toEqual({
      safe: '타임플라워 의정부',
    });
  });

  it('rejects phone-like input', () => {
    expect(sanitizeVendorQuery('선유꽃화원 010-4821-7732')).toEqual({
      rejected: 'phone-like',
    });
    expect(sanitizeVendorQuery('02-518-2400')).toEqual({
      rejected: 'phone-like',
    });
  });

  it('rejects address-like input', () => {
    expect(sanitizeVendorQuery('서울 강남구 선릉로 757')).toEqual({
      rejected: 'address-like',
    });
    expect(sanitizeVendorQuery('더채플앳청담 3층')).toEqual({
      rejected: 'address-like',
    });
  });

  it('rejects long mixed lines', () => {
    expect(
      sanitizeVendorQuery('받는분 김민준 실장 수령인 전화 상품 축하 화환'),
    ).toEqual({ rejected: 'too-many-tokens' });
  });
});

describe('verifyVendor sanitizes before any network call', () => {
  const trap = (): { dir: VendorDirectory; calls: string[] } => {
    const calls: string[] = [];
    const dir: VendorDirectory = {
      id: 'mock',
      async search(q: string): Promise<VendorCandidate[]> {
        calls.push(q);
        return [{ name: '선유꽃화원' }];
      },
    };
    return { dir, calls };
  };

  it('does not call search() for unsafe mixed/PII input', async () => {
    const { dir, calls } = trap();
    const v = await verifyVendor(dir, '선유꽃화원 010-4821-7732');
    expect(v.status).toBe('skipped');
    expect(v.reason).toBe('unsafe:phone-like');
    expect(calls).toHaveLength(0); // 네트워크로 나가지 않음
  });

  it('searches only the sanitized business name for clean input', async () => {
    const { dir, calls } = trap();
    await verifyVendor(dir, '  선유꽃화원  ');
    expect(calls).toEqual(['선유꽃화원']);
  });
});
