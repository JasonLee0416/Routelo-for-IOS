import { dialableTargets, formatPhone, telHref } from '../phone';

describe('formatPhone', () => {
  test('formats mobile, Seoul, and local numbers', () => {
    expect(formatPhone('01012345678')).toBe('010-1234-5678');
    expect(formatPhone('0212345678')).toBe('02-1234-5678');
    expect(formatPhone('0312345678')).toBe('031-234-5678');
    expect(formatPhone('021234567')).toBe('02-123-4567');
  });

  test('strips existing formatting before reformatting', () => {
    expect(formatPhone('010 1234 5678')).toBe('010-1234-5678');
  });

  test('returns empty for missing input and the original for unknown lengths', () => {
    expect(formatPhone('')).toBe('');
    expect(formatPhone(undefined)).toBe('');
    expect(formatPhone('12345')).toBe('12345');
  });
});

describe('telHref', () => {
  test('builds a tel: URL from a valid number, stripping formatting', () => {
    expect(telHref('010-1111-2222')).toBe('tel:01011112222');
    expect(telHref('02 1234 5678')).toBe('tel:0212345678');
    expect(telHref('+82 10 1234 5678')).toBe('tel:+821012345678');
  });

  test('returns null for missing or too-short numbers', () => {
    expect(telHref('')).toBeNull();
    expect(telHref(undefined)).toBeNull();
    expect(telHref(null)).toBeNull();
    expect(telHref('123-45')).toBeNull();
  });
});

describe('dialableTargets', () => {
  test('keeps only dialable entries, in order', () => {
    expect(
      dialableTargets([
        { label: '수령인', phone: '010-1111-2222' },
        { label: '발주처', phone: '' },
        { label: '화원', phone: '02-333-4444' },
      ]),
    ).toEqual([
      { label: '수령인', href: 'tel:01011112222' },
      { label: '화원', href: 'tel:023334444' },
    ]);
  });

  test('is empty when nothing is dialable', () => {
    expect(dialableTargets([{ label: '수령인', phone: undefined }])).toEqual([]);
  });
});
