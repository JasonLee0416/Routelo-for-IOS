import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

import { decodeCtc } from './ctc';
import { extractDbTextRegions } from './dbPostprocess';
import {
  detectorTensorData,
  prepareDetectorImage,
  prepareRecognitionCrop,
  recognizerTensorData,
} from './image';
import { PP_OCR_MODEL_VERSION } from './modelManifest';
import type { PpOcrLine, PpOcrResult } from './types';

// 모델은 Xcode 리소스 폴더 참조(assets/ocr → 번들 /ocr)로 앱에 실린다.
// (expo-asset 시절의 metro require 방식 대체)
const MODEL_DIR = `${RNFS.MainBundlePath}/ocr`;
const DETECTOR_PATH = `${MODEL_DIR}/ch_PP-OCRv5_det_mobile.onnx`;
const RECOGNIZER_PATH = `${MODEL_DIR}/korean_PP-OCRv5_rec_mobile.onnx`;
const DICTIONARY_PATH = `${MODEL_DIR}/ppocrv5_korean_dict.txt`;

type OrtModule = typeof import('onnxruntime-react-native');
type OrtSession = import('onnxruntime-react-native').InferenceSession;

let runtimePromise: Promise<{
  ort: OrtModule;
  detector: OrtSession;
  recognizer: OrtSession;
  dictionary: string[];
}> | null = null;

async function loadDictionary(path: string) {
  const content = await RNFS.readFile(path, 'utf8');
  return content
    .split(/\r?\n/)
    .map((entry) => entry.trimEnd())
    .filter(Boolean);
}

async function loadRuntime() {
  if (Platform.OS !== 'ios') {
    throw new Error('PP-OCR requires an iOS native build.');
  }
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const ort = await import('onnxruntime-react-native');
      const [detector, recognizer, dictionary] = await Promise.all([
        ort.InferenceSession.create(DETECTOR_PATH, {
          executionProviders: ['cpu'],
          graphOptimizationLevel: 'all',
        }),
        ort.InferenceSession.create(RECOGNIZER_PATH, {
          executionProviders: ['cpu'],
          graphOptimizationLevel: 'all',
        }),
        loadDictionary(DICTIONARY_PATH),
      ]);
      return { ort, detector, recognizer, dictionary };
    })();
  }
  return runtimePromise;
}

function tensorShape(output: import('onnxruntime-react-native').Tensor) {
  return output.dims.map(Number);
}

export function ppOcrCapability() {
  const available = Platform.OS === 'ios';
  return {
    available,
    engine: 'ppocrv5' as const,
    modelVersion: PP_OCR_MODEL_VERSION,
    reason: available
      ? undefined
      : `PP-OCR is unavailable on ${Platform.OS}.`,
  };
}

export async function recognizeReceiptWithPpOcr(
  imageUri: string,
): Promise<PpOcrResult> {
  if (!imageUri.trim()) throw new Error('Receipt image URI is required.');
  const startedAt = Date.now();
  const { ort, detector, recognizer, dictionary } = await loadRuntime();
  const detectorImage = await prepareDetectorImage(imageUri);
  const detectorInput = new ort.Tensor(
    'float32',
    detectorTensorData(detectorImage),
    [1, 3, detectorImage.height, detectorImage.width],
  );
  const detectorOutputMap = await detector.run({
    [detector.inputNames[0]]: detectorInput,
  });
  const detectorOutput = detectorOutputMap[detector.outputNames[0]];
  const detectorShape = tensorShape(detectorOutput);
  const mapHeight = detectorShape.at(-2);
  const mapWidth = detectorShape.at(-1);
  if (!mapHeight || !mapWidth) {
    throw new Error(`Unexpected PP-OCR detector output: ${detectorShape}.`);
  }
  const probabilities = detectorOutput.data as Float32Array;
  const mapOffset = probabilities.length - mapHeight * mapWidth;
  const regions = extractDbTextRegions(
    probabilities.subarray(mapOffset),
    mapWidth,
    mapHeight,
    detectorImage.sourceWidth,
    detectorImage.sourceHeight,
  );

  const lines: PpOcrLine[] = [];
  for (const region of regions) {
    const crop = await prepareRecognitionCrop(imageUri, region);
    const input = new ort.Tensor('float32', recognizerTensorData(crop), [
      1,
      3,
      crop.height,
      320,
    ]);
    const outputMap = await recognizer.run({
      [recognizer.inputNames[0]]: input,
    });
    const output = outputMap[recognizer.outputNames[0]];
    const shape = tensorShape(output);
    const steps = shape.at(-2);
    const classes = shape.at(-1);
    if (!steps || !classes) continue;
    const decoded = decodeCtc(
      output.data as Float32Array,
      steps,
      classes,
      dictionary,
    );
    if (decoded.text && decoded.confidence >= 0.35) {
      lines.push({
        text: decoded.text,
        confidence: decoded.confidence,
        boundingBox: region.boundingBox,
        cornerPoints: region.cornerPoints,
      });
    }
  }

  return {
    engine: 'ppocrv5',
    modelVersion: PP_OCR_MODEL_VERSION,
    fullText: lines.map(({ text }) => text).join('\n'),
    lines,
    processingMs: Date.now() - startedAt,
  };
}
