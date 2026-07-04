import {
  mapVisionPayloadToResult,
  visionBoxToPixels,
  type VisionPayload,
} from '../appleVision';

describe('visionBoxToPixels', () => {
  test('flips the Y axis (bottom-left normalized -> top-left pixels)', () => {
    // A box hugging the TOP of the image in Vision space has a high y origin.
    expect(
      visionBoxToPixels({ x: 0, y: 0.9, w: 0.5, h: 0.1 }, 1000, 2000),
    ).toEqual({ x: 0, y: 0, width: 500, height: 200 });
  });

  test('a bottom-of-image box maps near the bottom in pixel space', () => {
    expect(
      visionBoxToPixels({ x: 0.25, y: 0, w: 0.5, h: 0.1 }, 1000, 2000),
    ).toEqual({ x: 250, y: 1800, width: 500, height: 200 });
  });

  test('clamps degenerate boxes to at least 1px', () => {
    const box = visionBoxToPixels({ x: 0.5, y: 0.5, w: 0, h: 0 }, 800, 600);
    expect(box.width).toBe(1);
    expect(box.height).toBe(1);
  });
});

describe('mapVisionPayloadToResult', () => {
  const payload: VisionPayload = {
    imageWidth: 1000,
    imageHeight: 2000,
    processingMs: 42,
    osVersion: '17.2',
    lines: [
      { text: '  품명 축하3단 ', confidence: 0.97, box: { x: 0.1, y: 0.8, w: 0.4, h: 0.05 } },
      { text: '', confidence: 0.9, box: { x: 0, y: 0, w: 0.1, h: 0.1 } },
      { text: '수량 1', confidence: 0.88, box: { x: 0.6, y: 0.8, w: 0.2, h: 0.05 } },
    ],
  };

  test('maps engine metadata and drops empty lines', () => {
    const result = mapVisionPayloadToResult(payload);
    expect(result.engine).toBe('apple-vision');
    expect(result.modelVersion).toBe('apple-vision.vnrecognizetext.ios17.2');
    expect(result.processingMs).toBe(42);
    expect(result.lines).toHaveLength(2); // empty-text line filtered
  });

  test('trims text and builds newline-joined fullText', () => {
    const result = mapVisionPayloadToResult(payload);
    expect(result.lines[0].text).toBe('품명 축하3단');
    expect(result.fullText).toBe('품명 축하3단\n수량 1');
  });

  test('produces pixel bounding boxes and 4 corner points', () => {
    const [line] = mapVisionPayloadToResult(payload).lines;
    expect(line.boundingBox).toEqual({ x: 100, y: 300, width: 400, height: 100 });
    expect(line.cornerPoints).toEqual([
      { x: 100, y: 300 },
      { x: 500, y: 300 },
      { x: 500, y: 400 },
      { x: 100, y: 400 },
    ]);
  });
});
