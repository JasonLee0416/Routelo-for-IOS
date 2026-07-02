export type LayoutTextLine = {
  text: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

type LayoutRow = {
  centerY: number;
  height: number;
  lines: Required<Pick<LayoutTextLine, 'text' | 'boundingBox'>>[];
};

const belongsToRow = (
  row: LayoutRow,
  line: Required<Pick<LayoutTextLine, 'text' | 'boundingBox'>>,
) => {
  const box = line.boundingBox;
  const centerY = box.y + box.height / 2;
  return (
    Math.abs(centerY - row.centerY) <=
    Math.max(row.height, box.height) * 0.55
  );
};

export function buildLayoutText(lines: LayoutTextLine[], fallbackText = '') {
  const positioned = lines
    .filter(
      (
        line,
      ): line is Required<Pick<LayoutTextLine, 'text' | 'boundingBox'>> =>
        Boolean(line.text.trim() && line.boundingBox),
    )
    .sort((left, right) => {
      const vertical = left.boundingBox.y - right.boundingBox.y;
      return vertical || left.boundingBox.x - right.boundingBox.x;
    });

  if (!positioned.length) {
    const lineText = lines.map(({ text }) => text.trim()).filter(Boolean);
    return lineText.length ? lineText.join('\n') : fallbackText;
  }

  const rows: LayoutRow[] = [];
  positioned.forEach((line) => {
    const row = rows.find((candidate) => belongsToRow(candidate, line));
    const centerY = line.boundingBox.y + line.boundingBox.height / 2;
    if (!row) {
      rows.push({
        centerY,
        height: line.boundingBox.height,
        lines: [line],
      });
      return;
    }
    row.lines.push(line);
    row.centerY =
      row.lines.reduce(
        (sum, item) =>
          sum + item.boundingBox.y + item.boundingBox.height / 2,
        0,
      ) / row.lines.length;
    row.height = Math.max(row.height, line.boundingBox.height);
  });

  const layoutText = rows
    .sort((left, right) => left.centerY - right.centerY)
    .map((row) =>
      row.lines
        .sort((left, right) => left.boundingBox.x - right.boundingBox.x)
        .map(({ text }) => text.trim())
        .filter(Boolean)
        .join(' '),
    );
  const unpositioned = lines
    .filter((line) => line.text.trim() && !line.boundingBox)
    .map(({ text }) => text.trim());

  return [...layoutText, ...unpositioned].join('\n');
}
