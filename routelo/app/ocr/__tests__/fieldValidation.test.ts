import {
  detectFieldConflicts,
  isValidKoreanPhone,
  normalizeKoreanDate,
  normalizeKoreanPhone,
  normalizeKoreanTime,
  normalizeQuantity,
  parseTimeRange,
  scanStrictTime,
  scoreValueForType,
  validateFieldValue,
} from '../fieldValidation';

describe('normalizeKoreanPhone', () => {
  test('accepts 070 VoIP numbers (dominant on flower-shop receipts)', () => {
    expect(normalizeKoreanPhone('070-4741-0001')).toBe('070-4741-0001');
    expect(normalizeKoreanPhone('T.070 8277 1211')).toBe('070-8277-1211');
  });

  test('accepts national representative numbers (1566/1588 style)', () => {
    expect(normalizeKoreanPhone('본부전화:1566-0028')).toBe('1566-0028');
    expect(normalizeKoreanPhone('1599 0028')).toBe('1599-0028');
  });

  test('keeps existing mobile / seoul / area coverage', () => {
    expect(normalizeKoreanPhone('010-2479-1488')).toBe('010-2479-1488');
    expect(normalizeKoreanPhone('02-518-2400')).toBe('02-518-2400');
    expect(normalizeKoreanPhone('02-2038-1188')).toBe('02-2038-1188');
    expect(normalizeKoreanPhone('031-123-4567')).toBe('031-123-4567');
  });

  test('rejects malformed numbers', () => {
    expect(normalizeKoreanPhone('010-123-45')).toBe('');
    expect(normalizeKoreanPhone('260614')).toBe('');
    expect(isValidKoreanPhone('010-123-45')).toBe(false);
    expect(isValidKoreanPhone('070-4741-0001')).toBe(true);
  });
});

describe('normalizeKoreanDate', () => {
  test('parses the dominant Korean receipt format', () => {
    expect(normalizeKoreanDate('2026년 06월 14일')).toBe('2026-06-14');
    expect(normalizeKoreanDate('배송일시 2026년 6월 4일 (일요일)')).toBe('2026-06-04');
  });

  test('parses delimiter formats', () => {
    expect(normalizeKoreanDate('2026.06.14')).toBe('2026-06-14');
    expect(normalizeKoreanDate('2026-6-14')).toBe('2026-06-14');
    expect(normalizeKoreanDate('2026/06/14')).toBe('2026-06-14');
  });

  test('uses defaultYear only for year-less month/day', () => {
    expect(normalizeKoreanDate('06월 14일', 2026)).toBe('2026-06-14');
    expect(normalizeKoreanDate('06월 14일')).toBe(''); // no year -> conservative
  });

  test('rejects impossible calendar dates', () => {
    expect(normalizeKoreanDate('2026년 13월 40일')).toBe('');
    expect(normalizeKoreanDate('2026-02-30')).toBe('');
  });

  test('does not falsely match order-id digit runs', () => {
    expect(normalizeKoreanDate('NO:202606-260614-wleathdus-0001')).toBe('');
  });
});

describe('normalizeKoreanTime', () => {
  test('parses colon and Korean time forms', () => {
    expect(normalizeKoreanTime('17:00')).toBe('17:00');
    expect(normalizeKoreanTime('17시 00분')).toBe('17:00');
    expect(normalizeKoreanTime('12시20분')).toBe('12:20');
    expect(normalizeKoreanTime('9시')).toBe('09:00');
  });

  test('applies AM/PM', () => {
    expect(normalizeKoreanTime('오후 5시')).toBe('17:00');
    expect(normalizeKoreanTime('오전 12시')).toBe('00:00');
  });

  test('rejects out-of-range times', () => {
    expect(normalizeKoreanTime('24:00')).toBe('');
    expect(normalizeKoreanTime('12:70')).toBe('');
  });
});

describe('parseTimeRange', () => {
  test('extracts start/end from a delivery window', () => {
    expect(parseTimeRange('11:00~12:30')).toEqual({ start: '11:00', end: '12:30' });
    expect(parseTimeRange('배송 11:00 - 12시')).toEqual({ start: '11:00', end: '12:00' });
  });

  test('returns null when no range', () => {
    expect(parseTimeRange('17시 00분')).toBeNull();
  });
});

describe('normalizeQuantity', () => {
  test('extracts 1~99', () => {
    expect(normalizeQuantity('수량 1')).toBe('1');
    expect(normalizeQuantity('3 개')).toBe('3');
  });
  test('rejects out-of-range / noise', () => {
    expect(normalizeQuantity('0')).toBe('');
    expect(normalizeQuantity('수량 100')).toBe(''); // 2-digit cap catches 10, not 100 -> "10"? guard below
    expect(normalizeQuantity('그')).toBe('');
  });
});

describe('validateFieldValue', () => {
  test('dispatches by field type and reports errors', () => {
    expect(validateFieldValue('tel', '070-4741-0001')).toEqual({
      value: '070-4741-0001',
      valid: true,
      errors: [],
    });
    const bad = validateFieldValue('tel', '010-123-45');
    expect(bad.valid).toBe(false);
    expect(bad.errors.length).toBeGreaterThan(0);
    expect(validateFieldValue('datetime', '2026년 06월 14일').value).toBe('2026-06-14');
    expect(validateFieldValue('time', '17시 00분').value).toBe('17:00');
    expect(validateFieldValue('text', '  축하3단 ').value).toBe('축하3단');
  });
});

describe('scoreValueForType (field-aware re-ranking)', () => {
  test('a valid-typed value outscores an invalid one', () => {
    expect(scoreValueForType('tel', '070-4741-0001')).toBe(1);
    expect(scoreValueForType('tel', 'not a phone')).toBe(0);
  });
});

describe('detectFieldConflicts', () => {
  test('flags an inverted delivery window', () => {
    const c = detectFieldConflicts({
      deliveryWindowStart: '12:30',
      deliveryWindowEnd: '11:00',
    });
    expect(c).toHaveLength(1);
    expect(c[0].keys).toEqual(['deliveryWindowStart', 'deliveryWindowEnd']);
  });

  test('flags strict time later than event time', () => {
    const c = detectFieldConflicts({ strictTime: '13:00', eventTime: '12:00' });
    expect(c[0].keys).toEqual(['strictTime', 'eventTime']);
  });

  test('no conflict when consistent', () => {
    expect(
      detectFieldConflicts({ strictTime: '11:00', eventTime: '12:00' }),
    ).toHaveLength(0);
  });
});

describe('scanStrictTime (마감시각 값-형식 회복)', () => {
  test('"17시 00분 까지 배송" → 17:00 + 원문 span', () => {
    const r = scanStrictTime('2026년 06월 14일 일요일 17시 00분 까지 배송 ()');
    expect(r?.value).toBe('17:00');
    expect(r?.source).toContain('17시');
    expect(r?.source).toContain('까지 배송');
  });
  test('"오후 5시 엄수" 지원', () => {
    expect(scanStrictTime('오후 5시 엄수')?.value).toBe('17:00');
  });
  test('배달 시간창의 단순 "까지"는 잡지 않음(배송/도착/엄수 요구)', () => {
    expect(scanStrictTime('11:00~12:30 까지')).toBeNull();
  });
  test('주문 시각처럼 마감 문맥이 없으면 null', () => {
    expect(scanStrictTime('14시 43분 주문합니다')).toBeNull();
  });
});
