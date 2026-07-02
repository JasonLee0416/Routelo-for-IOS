import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const scanRoots = ['app', 'modules'];
const explicitFiles = ['app.json', 'package.json'];
const forbidden = /(?:com\.google\.mlkit|RouteloMlkit|recognizeReceiptWithMlKit|['"]mlkit(?:-demo)?['"])/;
const sourceExtensions = new Set([
  '.gradle',
  '.java',
  '.json',
  '.kt',
  '.m',
  '.mm',
  '.swift',
  '.ts',
  '.tsx',
]);
const violations = [];

async function scan(path) {
  const entry = await stat(path).catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (!entry) return;
  if (entry.isDirectory()) {
    for (const child of await readdir(path)) await scan(join(path, child));
    return;
  }
  if (!sourceExtensions.has(extname(path))) return;
  const content = await readFile(path, 'utf8');
  if (forbidden.test(content)) violations.push(relative(root, path));
}

for (const path of scanRoots) await scan(join(root, path));
for (const path of explicitFiles) await scan(join(root, path));

if (violations.length) {
  throw new Error(`ML Kit production references remain:\n${violations.join('\n')}`);
}

console.log('No ML Kit production code or dependency remains.');
