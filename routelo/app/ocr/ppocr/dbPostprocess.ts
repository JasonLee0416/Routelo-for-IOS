import type { PpOcrRegion } from './types';

export type DbPostprocessOptions = {
  threshold?: number;
  boxThreshold?: number;
  minArea?: number;
  unclipRatio?: number;
  maxRegions?: number;
};

type Component = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  pixels: number;
  score: number;
};

function verticalOverlap(left: PpOcrRegion, right: PpOcrRegion) {
  const leftBox = left.boundingBox;
  const rightBox = right.boundingBox;
  const overlap = Math.max(
    0,
    Math.min(leftBox.y + leftBox.height, rightBox.y + rightBox.height) -
      Math.max(leftBox.y, rightBox.y),
  );
  return overlap / Math.max(1, Math.min(leftBox.height, rightBox.height));
}

function horizontalGap(left: PpOcrRegion, right: PpOcrRegion) {
  const leftBox = left.boundingBox;
  const rightBox = right.boundingBox;
  if (leftBox.x + leftBox.width < rightBox.x) {
    return rightBox.x - (leftBox.x + leftBox.width);
  }
  if (rightBox.x + rightBox.width < leftBox.x) {
    return leftBox.x - (rightBox.x + rightBox.width);
  }
  return 0;
}

function mergeTextRows(regions: PpOcrRegion[]): PpOcrRegion[] {
  const rows: PpOcrRegion[] = [];
  regions
    .sort(
      (left, right) =>
        left.boundingBox.y - right.boundingBox.y ||
        left.boundingBox.x - right.boundingBox.x,
    )
    .forEach((region) => {
      const rowIndex = rows.findIndex(
        (row) =>
          verticalOverlap(row, region) >= 0.45 &&
          horizontalGap(row, region) <=
            Math.max(row.boundingBox.height, region.boundingBox.height) * 3,
      );
      if (rowIndex < 0) {
        rows.push(region);
        return;
      }
      const row = rows[rowIndex];
      const left = Math.min(row.boundingBox.x, region.boundingBox.x);
      const top = Math.min(row.boundingBox.y, region.boundingBox.y);
      const right = Math.max(
        row.boundingBox.x + row.boundingBox.width,
        region.boundingBox.x + region.boundingBox.width,
      );
      const bottom = Math.max(
        row.boundingBox.y + row.boundingBox.height,
        region.boundingBox.y + region.boundingBox.height,
      );
      const boundingBox = {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
      };
      rows[rowIndex] = {
        score: Math.max(row.score, region.score),
        boundingBox,
        cornerPoints: [
          { x: left, y: top },
          { x: right, y: top },
          { x: right, y: bottom },
          { x: left, y: bottom },
        ],
      };
    });
  return rows;
}

const NEIGHBORS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;

export function extractDbTextRegions(
  probabilityMap: Float32Array,
  width: number,
  height: number,
  sourceWidth: number,
  sourceHeight: number,
  options: DbPostprocessOptions = {},
): PpOcrRegion[] {
  const threshold = options.threshold ?? 0.3;
  const boxThreshold = options.boxThreshold ?? 0.5;
  const minArea = options.minArea ?? 12;
  const unclipRatio = options.unclipRatio ?? 1.6;
  const maxRegions = options.maxRegions ?? 96;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const components: Component[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (visited[start] || probabilityMap[start] < threshold) continue;

      let head = 0;
      let tail = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let score = 0;
      queue[tail++] = start;
      visited[start] = 1;

      while (head < tail) {
        const current = queue[head++];
        const currentX = current % width;
        const currentY = Math.floor(current / width);
        score += probabilityMap[current];
        minX = Math.min(minX, currentX);
        maxX = Math.max(maxX, currentX);
        minY = Math.min(minY, currentY);
        maxY = Math.max(maxY, currentY);

        NEIGHBORS.forEach(([dx, dy]) => {
          const nextX = currentX + dx;
          const nextY = currentY + dy;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
            return;
          }
          const next = nextY * width + nextX;
          if (!visited[next] && probabilityMap[next] >= threshold) {
            visited[next] = 1;
            queue[tail++] = next;
          }
        });
      }

      const pixels = tail;
      const averageScore = pixels ? score / pixels : 0;
      if (pixels >= minArea && averageScore >= boxThreshold) {
        components.push({
          minX,
          minY,
          maxX,
          maxY,
          pixels,
          score: averageScore,
        });
      }
    }
  }

  const scaleX = sourceWidth / width;
  const scaleY = sourceHeight / height;
  return mergeTextRows(components
    .map((component): PpOcrRegion => {
      const rawWidth = component.maxX - component.minX + 1;
      const rawHeight = component.maxY - component.minY + 1;
      const expandX = (rawWidth * (unclipRatio - 1)) / 2;
      const expandY = (rawHeight * (unclipRatio - 1)) / 2;
      const left = Math.max(0, (component.minX - expandX) * scaleX);
      const top = Math.max(0, (component.minY - expandY) * scaleY);
      const right = Math.min(
        sourceWidth,
        (component.maxX + 1 + expandX) * scaleX,
      );
      const bottom = Math.min(
        sourceHeight,
        (component.maxY + 1 + expandY) * scaleY,
      );
      const boundingBox = {
        x: Math.floor(left),
        y: Math.floor(top),
        width: Math.max(1, Math.ceil(right - left)),
        height: Math.max(1, Math.ceil(bottom - top)),
      };
      return {
        score: component.score,
        boundingBox,
        cornerPoints: [
          { x: boundingBox.x, y: boundingBox.y },
          { x: boundingBox.x + boundingBox.width, y: boundingBox.y },
          {
            x: boundingBox.x + boundingBox.width,
            y: boundingBox.y + boundingBox.height,
          },
          { x: boundingBox.x, y: boundingBox.y + boundingBox.height },
        ],
      };
    })
    .filter(
      ({ boundingBox }) =>
        boundingBox.width >= 8 &&
        boundingBox.height >= 6 &&
        boundingBox.width * boundingBox.height <
          sourceWidth * sourceHeight * 0.6,
    ))
    .sort(
      (left, right) =>
        left.boundingBox.y - right.boundingBox.y ||
        left.boundingBox.x - right.boundingBox.x,
    )
    .slice(0, maxRegions);
}
