import RNFS from 'react-native-fs';

// expo-file-system 호환 서피스(앱이 쓰던 부분만)를 react-native-fs 위에 제공.
// 경로는 expo와 동일하게 file:// URI로 주고받아 Image 표시 등 URI 소비처가
// 그대로 동작한다.

export const documentDirectory = `file://${RNFS.DocumentDirectoryPath}/`;

function toPath(uri: string): string {
  if (!uri.startsWith('file://')) return uri;
  const path = uri.slice('file://'.length);
  return path.includes('%') ? decodeURIComponent(path) : path;
}

export async function getInfoAsync(uri: string): Promise<{ exists: boolean }> {
  return { exists: await RNFS.exists(toPath(uri)) };
}

export async function makeDirectoryAsync(
  uri: string,
  _options?: { intermediates?: boolean },
): Promise<void> {
  // RNFS.mkdir always creates intermediate directories on iOS.
  await RNFS.mkdir(toPath(uri));
}

export async function readAsStringAsync(uri: string): Promise<string> {
  return RNFS.readFile(toPath(uri), 'utf8');
}

export async function writeAsStringAsync(
  uri: string,
  content: string,
): Promise<void> {
  await RNFS.writeFile(toPath(uri), content, 'utf8');
}

export async function deleteAsync(
  uri: string,
  options?: { idempotent?: boolean },
): Promise<void> {
  try {
    await RNFS.unlink(toPath(uri));
  } catch (error) {
    if (!options?.idempotent) throw error;
  }
}

export async function copyAsync(options: {
  from: string;
  to: string;
}): Promise<void> {
  const to = toPath(options.to);
  // expo copyAsync overwrites; RNFS.copyFile fails on an existing target.
  try {
    await RNFS.unlink(to);
  } catch {
    // target did not exist
  }
  await RNFS.copyFile(toPath(options.from), to);
}

export async function readDirectoryAsync(uri: string): Promise<string[]> {
  const entries = await RNFS.readDir(toPath(uri));
  return entries.map((entry) => entry.name);
}
