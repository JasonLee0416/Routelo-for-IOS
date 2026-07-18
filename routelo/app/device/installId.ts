// 익명 설치 ID(개인 식별과 무관). 텔레메트리와 회원 자격이 같은 기기를 같은 ID로
// 가리키도록 단일 소스로 둔다. 키는 기존 텔레메트리 값과 동일하게 유지해 이미
// 발급된 ID가 그대로 이어지도록 한다.
type AsyncStoreLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export const INSTALL_ID_KEY = 'routelo.telemetry.deviceId';

export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let cache: string | undefined;

// 저장소는 주입 가능(테스트). 없으면 생성해 저장한다.
export async function getInstallId(store: AsyncStoreLike): Promise<string> {
  if (cache) return cache;
  let id = await store.getItem(INSTALL_ID_KEY);
  if (!id) {
    id = uuid();
    await store.setItem(INSTALL_ID_KEY, id);
  }
  cache = id;
  return id;
}

// 테스트 격리용.
export function __resetInstallIdCache(): void {
  cache = undefined;
}
