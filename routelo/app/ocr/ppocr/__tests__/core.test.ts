import { decodeCtc } from '../ctc';
import { extractDbTextRegions } from '../dbPostprocess';

describe('PP-OCR shared core', () => {
  it('decodes CTC blanks and repeated characters', () => {
    const logits = new Float32Array([
      10, 0, 0,
      0, 10, 0,
      0, 10, 0,
      10, 0, 0,
      0, 0, 10,
    ]);

    expect(decodeCtc(logits, 5, 3, ['가', '나'])).toEqual({
      text: '가나',
      confidence: 10,
    });
  });

  it('extracts and unclips connected detector regions', () => {
    const map = new Float32Array(8 * 6);
    for (let y = 2; y <= 3; y += 1) {
      for (let x = 2; x <= 5; x += 1) map[y * 8 + x] = 0.9;
    }

    const regions = extractDbTextRegions(map, 8, 6, 80, 60, {
      minArea: 4,
      unclipRatio: 1.5,
    });

    expect(regions).toHaveLength(1);
    expect(regions[0].score).toBeCloseTo(0.9);
    expect(regions[0].boundingBox.width).toBeGreaterThan(40);
    expect(regions[0].cornerPoints).toHaveLength(4);
  });
});
