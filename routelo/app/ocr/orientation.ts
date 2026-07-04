import { DEFAULT_FIELD_REGISTRY } from './fieldRegistry';
import { matchField } from './normalize';

// PR7: OCR 라인 방향 자동 보정.
// Apple Vision 등은 EXIF로 회전된 사진을 그 방향대로 인식해, 세로로 배열된 박스가
// 나올 수 있다. 가로 행을 가정하는 buildLayoutText가 이를 못 묶어 필드가 뭉개진다.
// 텍스트 박스가 "세로로 길면" 회전으로 판단하고, none/cw/ccw 중 라벨이 행 머리에
// 가장 많이 오는 방향(=가장 파싱하기 좋은 방향)을 고른다. 정상 방향이면 그대로 둔다.

export type LayoutBox = { x: number; y: number; width: number; height: number };
export type OrientedLine = { text: string; boundingBox?: LayoutBox };

type Rotation = 'none' | 'cw' | 'ccw';

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// 픽셀 좌표(좌상단)를 W×H 범위 기준으로 90° 회전. 회전 후 이미지 폭/높이는 뒤바뀐다.
function rotateBox(box: LayoutBox, W: number, H: number, rot: Rotation): LayoutBox {
  if (rot === 'none') return box;
  const x0 = box.x / W;
  const y0 = box.y / H;
  const w0 = box.width / W;
  const h0 = box.height / H;
  let nx: number;
  let ny: number;
  if (rot === 'ccw') {
    nx = y0;
    ny = 1 - (x0 + w0);
  } else {
    nx = 1 - (y0 + h0);
    ny = x0;
  }
  const DW = H;
  const DH = W;
  return {
    x: Math.round(nx * DW),
    y: Math.round(ny * DH),
    width: Math.max(1, Math.round(h0 * DW)),
    height: Math.max(1, Math.round(w0 * DH)),
  };
}

// 라벨이 행 머리에 오는 개수로 방향의 "파싱 적합도"를 점수화.
function labelRowScore(lines: OrientedLine[]): number {
  const boxed = lines.filter(
    (l): l is Required<OrientedLine> => Boolean(l.boundingBox && l.text.trim()),
  );
  if (!boxed.length) return 0;
  const heights = boxed.map((l) => l.boundingBox.height);
  const rowGap = Math.max(8, median(heights) * 0.6);
  const sorted = [...boxed].sort(
    (a, b) => a.boundingBox.y - b.boundingBox.y || a.boundingBox.x - b.boundingBox.x,
  );
  const rows: Required<OrientedLine>[][] = [];
  let current: Required<OrientedLine>[] = [];
  let rowY = -Infinity;
  for (const line of sorted) {
    const cy = line.boundingBox.y + line.boundingBox.height / 2;
    if (current.length && Math.abs(cy - rowY) > rowGap) {
      rows.push(current);
      current = [];
    }
    current.push(line);
    rowY = cy;
  }
  if (current.length) rows.push(current);

  let score = 0;
  for (const row of rows) {
    if (row.length < 2) continue; // 라벨+값이 한 행에 있어야 의미
    const leftmost = row.sort((a, b) => a.boundingBox.x - b.boundingBox.x)[0];
    const matched = matchField(leftmost.text, DEFAULT_FIELD_REGISTRY);
    if (matched && matched.score >= 0.8) score += 1;
  }
  return score;
}

/**
 * 라인 배열의 방향을 자동 감지·보정한다. 박스가 세로로 길지 않으면(정상) 그대로 반환.
 */
export function autoOrientLines(lines: OrientedLine[]): OrientedLine[] {
  const boxed = lines.filter(
    (l): l is Required<OrientedLine> =>
      Boolean(l.boundingBox && l.text.trim().length >= 2),
  );
  if (boxed.length < 4) return lines;

  const aspects = boxed.map((l) => l.boundingBox.width / l.boundingBox.height);
  if (median(aspects) >= 0.8) return lines; // 가로로 넓음 = 정상 방향

  const W = Math.max(...boxed.map((l) => l.boundingBox.x + l.boundingBox.width));
  const H = Math.max(...boxed.map((l) => l.boundingBox.y + l.boundingBox.height));

  const variants: Array<{ rot: Rotation; lines: OrientedLine[] }> = (
    ['none', 'cw', 'ccw'] as Rotation[]
  ).map((rot) => ({
    rot,
    lines: lines.map((l) =>
      l.boundingBox ? { ...l, boundingBox: rotateBox(l.boundingBox, W, H, rot) } : l,
    ),
  }));

  let best = variants[0];
  let bestScore = labelRowScore(variants[0].lines);
  for (const variant of variants.slice(1)) {
    const score = labelRowScore(variant.lines);
    if (score > bestScore) {
      bestScore = score;
      best = variant;
    }
  }
  return best.lines;
}
