import type {
  ReceiptRecognizerLine,
  ReceiptRecognizerResult,
} from './receiptRecognizers';

// Raw payload returned by the native Apple Vision module. Boxes stay in Vision's
// own coordinate space (normalized 0..1, bottom-left origin) — conversion to the
// app contract (source pixels, top-left origin) happens here so it is unit-testable
// without the native module.
export type VisionNormalizedBox = { x: number; y: number; w: number; h: number };

export type VisionRawLine = {
  text: string;
  confidence: number;
  box: VisionNormalizedBox;
};

export type VisionPayload = {
  imageWidth: number;
  imageHeight: number;
  processingMs: number;
  osVersion: string;
  lines: VisionRawLine[];
};

export class AppleVisionUnavailableError extends Error {
  constructor(
    message = 'Apple Vision OCR native module is unavailable on this platform.',
  ) {
    super(message);
    this.name = 'AppleVisionUnavailableError';
  }
}

export class AppleVisionNoTextError extends Error {
  constructor() {
    super('Apple Vision OCR returned no readable text.');
    this.name = 'AppleVisionNoTextError';
  }
}

/**
 * Convert a Vision bounding box (normalized 0..1, bottom-left origin) into the
 * app's line-box contract (source-image pixels, top-left origin) that
 * `buildLayoutText` and the field parser expect. The Y axis is flipped.
 */
export function visionBoxToPixels(
  box: VisionNormalizedBox,
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number; width: number; height: number } {
  const width = Math.max(1, Math.round(box.w * imageWidth));
  const height = Math.max(1, Math.round(box.h * imageHeight));
  const x = Math.round(box.x * imageWidth);
  // bottom-left origin -> top-left origin
  const y = Math.round((1 - (box.y + box.h)) * imageHeight);
  return { x, y, width, height };
}

function cornersFromBox(px: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Array<{ x: number; y: number }> {
  return [
    { x: px.x, y: px.y },
    { x: px.x + px.width, y: px.y },
    { x: px.x + px.width, y: px.y + px.height },
    { x: px.x, y: px.y + px.height },
  ];
}

/**
 * Map a raw native Vision payload into the shared `ReceiptRecognizerResult`
 * contract, so downstream layout/normalization is engine-agnostic.
 */
export function mapVisionPayloadToResult(
  payload: VisionPayload,
): ReceiptRecognizerResult {
  const { imageWidth, imageHeight } = payload;
  const lines: ReceiptRecognizerLine[] = payload.lines
    .filter((line) => line.text.trim())
    .map((line) => {
      const boundingBox = visionBoxToPixels(line.box, imageWidth, imageHeight);
      return {
        text: line.text.trim(),
        confidence: line.confidence,
        boundingBox,
        cornerPoints: cornersFromBox(boundingBox),
      };
    });
  return {
    engine: 'apple-vision',
    modelVersion: `apple-vision.vnrecognizetext.ios${payload.osVersion}`,
    fullText: lines.map((line) => line.text).join('\n'),
    lines,
    processingMs: payload.processingMs,
  };
}
