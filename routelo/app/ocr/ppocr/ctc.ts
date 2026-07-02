export type CtcDecodeResult = {
  text: string;
  confidence: number;
};

export function decodeCtc(
  logits: Float32Array,
  steps: number,
  classes: number,
  dictionary: string[],
): CtcDecodeResult {
  const characters: string[] = [];
  let previous = -1;
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (let step = 0; step < steps; step += 1) {
    let bestIndex = 0;
    let bestValue = Number.NEGATIVE_INFINITY;
    const offset = step * classes;
    for (let character = 0; character < classes; character += 1) {
      const value = logits[offset + character];
      if (value > bestValue) {
        bestValue = value;
        bestIndex = character;
      }
    }
    if (bestIndex !== 0 && bestIndex !== previous) {
      const decoded = dictionary[bestIndex - 1];
      if (decoded) {
        characters.push(decoded);
        confidenceSum += bestValue;
        confidenceCount += 1;
      }
    }
    previous = bestIndex;
  }

  return {
    text: characters.join('').trim(),
    confidence: confidenceCount ? confidenceSum / confidenceCount : 0,
  };
}
