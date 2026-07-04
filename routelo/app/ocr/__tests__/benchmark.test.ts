import { computeFieldMetrics, FieldExpectation } from '../benchmark';
import { parseReceiptText } from '../../services/ocr';

// 클린한 인수증 텍스트에 대한 정답(ground-truth). parser가 이 값을 재현하면 100%.
// 미래 변경이 정확도를 떨어뜨리면 이 벤치마크가 회귀로 잡는다.
const DEMO_TEXT = [
  '배송 인수증',
  '주문번호 FL-20260621-1842',
  '발주화원 마음꽃화원',
  '발주화원 전화 02-518-2400',
  '배송화원 로즈플라워',
  '배송화원 전화 02-2038-1188',
  '배송일자 2026.06.21',
  '업체명 더채플앳청담',
  '배송주소 서울 강남구 선릉로 757 더채플앳청담 3층',
  '받는 분 김민준 실장',
  '수령인 전화 010-4821-7732',
  '배달 엄수 10:30까지',
  '예식 시간 오전 11시',
  '상품 축하 3단 화환 2개',
  '리본 문구 결혼을 축하드립니다',
  '요청사항 예식 시작 30분 전 설치 완료, 설치 후 사진 전송',
].join('\n');

const GROUND_TRUTH: FieldExpectation = {
  orderingVendorName: '마음꽃화원',
  orderingVendorTel: '02-518-2400',
  fulfillingVendorName: '로즈플라워',
  fulfillingVendorTel: '02-2038-1188',
  deliveryDate: '2026-06-21',
  venueName: '더채플앳청담',
  deliveryAddress: '서울 강남구 선릉로 757 더채플앳청담 3층',
  recipientName: '김민준 실장',
  recipientTel: '010-4821-7732',
  strictTime: '10:30',
  eventTime: '11:00',
  productName: '축하 3단 화환',
  productQuantity: '2',
  ribbonText: '결혼을 축하드립니다',
  memo: '예식 시작 30분 전 설치 완료, 설치 후 사진 전송',
};

const quality = {
  score: 90, blur: 90, brightness: 90, documentCoverage: 90,
  skew: 90, shadow: 90, passed: true, messages: [],
};

describe('field-level benchmark (clean receipt)', () => {
  const parsed = parseReceiptText(DEMO_TEXT, quality);
  const metrics = computeFieldMetrics(GROUND_TRUTH, parsed.fields);

  test('required fields (date / product / address) are 100% correct', () => {
    if (metrics.requiredAccuracy < 1) {
      // 실패 시 어떤 필드가 틀렸는지 드러내 회귀 진단을 돕는다.
      // eslint-disable-next-line no-console
      console.log('required wrong:', JSON.stringify(metrics.wrong));
    }
    expect(metrics.requiredAccuracy).toBe(1);
  });

  test('overall field accuracy is perfect on clean text', () => {
    if (metrics.accuracy < 1) {
      // eslint-disable-next-line no-console
      console.log('wrong:', JSON.stringify(metrics.wrong));
    }
    expect(metrics.accuracy).toBe(1);
  });

  test('no cloud fallback is suggested when everything parses', () => {
    expect(parsed.cloudFallback.trigger).toBe(false);
  });
});
