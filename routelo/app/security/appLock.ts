// 기본 PIN 앱 잠금. djb2 해시는 암호학적 강도가 아니라 "평문 저장 방지 + 억지력"
// 수준의 기본선이다(생체/Keychain 보안 저장은 후속 강화 항목). PIN 원문은 저장하지 않는다.
//
// 순수 함수(hashPin/verifyPin/isValidPin)만 임포트해도 네이티브 모듈이 로드되지 않도록
// AsyncStorage는 저장이 필요한 시점에만 지연 로드한다.
type AsyncStoreLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
function store(): AsyncStoreLike {
  return require('@react-native-async-storage/async-storage').default;
}

const KEY = 'routelo.appLock.pinHash.v1';

export function hashPin(pin: string): string {
  let h = 5381;
  for (let i = 0; i < pin.length; i++) {
    h = (((h << 5) + h) ^ pin.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

export function verifyPin(pin: string, hash: string): boolean {
  return hashPin(pin) === hash;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

export async function setPin(pin: string): Promise<void> {
  await store().setItem(KEY, hashPin(pin));
}

export async function getPinHash(): Promise<string | null> {
  return store().getItem(KEY);
}

export async function clearPin(): Promise<void> {
  await store().removeItem(KEY);
}

export async function hasPin(): Promise<boolean> {
  return (await getPinHash()) !== null;
}
