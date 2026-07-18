// CSV 직렬화(순수 함수). 셀 이스케이프(쉼표/따옴표/개행)와 엑셀 한글 호환용 BOM 옵션.

export function escapeCsvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
  opts: { bom?: boolean } = {},
): string {
  const lines = [headers, ...rows].map((row) =>
    row.map(escapeCsvCell).join(','),
  );
  const body = lines.join('\r\n');
  // 엑셀/한글에서 UTF-8 인식을 위해 BOM을 앞에 붙일 수 있다.
  return opts.bom ? '﻿' + body : body;
}
