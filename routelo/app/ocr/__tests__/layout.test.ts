import { buildLayoutText } from '../layout';

describe('OCR layout reconstruction', () => {
  it('groups fragments by row and orders them from left to right', () => {
    const text = buildLayoutText([
      { text: '010-1234-5678', boundingBox: { x: 180, y: 50, width: 120, height: 20 } },
      { text: '수령인 전화', boundingBox: { x: 10, y: 48, width: 100, height: 22 } },
      { text: '김민준', boundingBox: { x: 180, y: 10, width: 70, height: 20 } },
      { text: '받는 분', boundingBox: { x: 10, y: 12, width: 80, height: 20 } },
    ]);

    expect(text).toBe('받는 분 김민준\n수령인 전화 010-1234-5678');
  });

  it('preserves recognizer order when geometry is unavailable', () => {
    expect(
      buildLayoutText([{ text: '주문번호 A-12345' }, { text: '상품 축하화환' }]),
    ).toBe('주문번호 A-12345\n상품 축하화환');
  });

  it('uses fallback text when no usable line exists', () => {
    expect(buildLayoutText([], '배송주소 서울 강남구')).toBe(
      '배송주소 서울 강남구',
    );
  });
});
