import { rm, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const apply = process.argv.includes('--apply');
const includeDependencies = process.argv.includes('--dependencies');
const targets = [
  '.expo',
  'dist',
  'dist-android',
  'dist-ios',
  'android',
  'ios',
  ...(includeDependencies ? ['node_modules'] : []),
].map((path) => join(root, path));

async function exists(path) {
  return Boolean(await stat(path).catch(() => null));
}

const existing = [];
for (const path of targets) {
  if (await exists(path)) existing.push(path);
}

if (!existing.length) {
  console.log('No device-test build artifacts are present.');
  process.exit(0);
}

console.log(`${apply ? 'Removing' : 'Would remove'}:`);
for (const path of existing) console.log(`- ${relative(root, path)}`);

if (!apply) {
  console.log('\nDry run only. Re-run with --apply to delete these paths.');
  console.log('Add --dependencies to include node_modules.');
  process.exit(0);
}

for (const path of existing) {
  await rm(path, { recursive: true, force: true });
}
console.log('Device-test artifacts removed.');
