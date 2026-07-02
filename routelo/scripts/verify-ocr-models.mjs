import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ort from 'onnxruntime-node';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const modelRoot = join(root, 'assets', 'ocr');
const manifest = JSON.parse(
  await readFile(join(modelRoot, 'manifest.json'), 'utf8'),
);

for (const asset of manifest.assets) {
  const bytes = await readFile(join(modelRoot, asset.file));
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== asset.sha256) {
    throw new Error(`${asset.file} SHA-256 mismatch: ${actual}`);
  }
}

const detector = await ort.InferenceSession.create(
  join(modelRoot, manifest.assets.find(({ role }) => role === 'detector').file),
);
const recognizer = await ort.InferenceSession.create(
  join(modelRoot, manifest.assets.find(({ role }) => role === 'recognizer').file),
);

const detectorInput = new ort.Tensor(
  'float32',
  new Float32Array(3 * 32 * 32),
  [1, 3, 32, 32],
);
const detectorResult = await detector.run({
  [detector.inputNames[0]]: detectorInput,
});
const detectorOutput = detectorResult[detector.outputNames[0]];
if (!detectorOutput || detectorOutput.data.length === 0) {
  throw new Error('PP-OCR detector returned no tensor data.');
}

const recognizerInput = new ort.Tensor(
  'float32',
  new Float32Array(3 * 48 * 320),
  [1, 3, 48, 320],
);
const recognizerResult = await recognizer.run({
  [recognizer.inputNames[0]]: recognizerInput,
});
const recognizerOutput = recognizerResult[recognizer.outputNames[0]];
if (!recognizerOutput || recognizerOutput.data.length === 0) {
  throw new Error('PP-OCR recognizer returned no tensor data.');
}

console.log(
  JSON.stringify({
    engine: manifest.engine,
    modelVersion: manifest.modelVersion,
    detectorOutput: detectorOutput.dims,
    recognizerOutput: recognizerOutput.dims,
  }),
);
