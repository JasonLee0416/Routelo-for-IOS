import { escapeCsvCell, toCsv } from '../export/csv';
import { buildErrorRecord, pushBounded } from '../reliability/errorReporting';
import { hashPin, isValidPin, verifyPin } from '../security/appLock';

describe('csv export', () => {
  it('escapes commas, quotes and newlines', () => {
    expect(escapeCsvCell('강남구')).toBe('강남구');
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('he said "hi"')).toBe('"he said ""hi"""');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(1200)).toBe('1200');
  });

  it('builds a CRLF csv with header + rows, optional BOM', () => {
    const csv = toCsv(
      ['날짜', '금액'],
      [
        ['2026-07-14', 20000],
        ['a,b', 0],
      ],
    );
    expect(csv).toBe('날짜,금액\r\n2026-07-14,20000\r\n"a,b",0');
    expect(toCsv(['x'], [], { bom: true }).startsWith('﻿')).toBe(true);
  });
});

describe('error reporting', () => {
  it('builds a bounded, truncated error record', () => {
    const rec = buildErrorRecord(new Error('boom'), true, 1000);
    expect(rec).toMatchObject({ ts: 1000, fatal: true, message: 'boom' });
    const long = buildErrorRecord({ message: 'x'.repeat(999) }, false, 1);
    expect(long.message.length).toBe(500);
  });

  it('keeps a ring buffer of the newest N', () => {
    let list: number[] = [];
    for (let i = 0; i < 5; i++) list = pushBounded(list, i, 3);
    expect(list).toEqual([2, 3, 4]);
  });
});

describe('app lock pin', () => {
  it('hashes deterministically without storing plaintext and verifies', () => {
    const h = hashPin('1234');
    expect(h).not.toContain('1234');
    expect(hashPin('1234')).toBe(h);
    expect(verifyPin('1234', h)).toBe(true);
    expect(verifyPin('0000', h)).toBe(false);
  });

  it('validates pin format', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('123456')).toBe(true);
    expect(isValidPin('12')).toBe(false);
    expect(isValidPin('abcd')).toBe(false);
  });
});
