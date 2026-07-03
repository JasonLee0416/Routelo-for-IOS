import { vendorCandidateApplications } from '../apply';
import { VendorCandidate } from '../types';

const candidate: VendorCandidate = {
  name: '선유꽃화원',
  phone: '02-1234-5678',
  address: '서울시 영등포구 선유로 1',
  latitude: 37.5,
  longitude: 126.9,
  category: '꽃집',
  url: 'https://place.map.kakao.com/1',
};

describe('vendorCandidateApplications', () => {
  test('applies only the ordering vendor name and phone', () => {
    expect(vendorCandidateApplications(candidate)).toEqual([
      { key: 'orderingVendorName', value: '선유꽃화원' },
      { key: 'orderingVendorTel', value: '02-1234-5678' },
    ]);
  });

  test('never applies address, category, or any non-vendor field', () => {
    const keys = vendorCandidateApplications(candidate).map((a) => a.key);
    expect(keys).not.toContain('deliveryAddress');
    expect(keys).not.toContain('recipientName');
    expect(keys).not.toContain('recipientTel');
    expect(keys).toEqual(['orderingVendorName', 'orderingVendorTel']);
  });

  test('omits phone when the candidate has none', () => {
    expect(vendorCandidateApplications({ name: '무전화화원' })).toEqual([
      { key: 'orderingVendorName', value: '무전화화원' },
    ]);
  });

  test('trims and skips blank values', () => {
    expect(
      vendorCandidateApplications({ name: '  가게  ', phone: '   ' }),
    ).toEqual([{ key: 'orderingVendorName', value: '가게' }]);
    expect(vendorCandidateApplications({ name: '   ' })).toEqual([]);
  });
});
