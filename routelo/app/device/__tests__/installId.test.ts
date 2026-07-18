import {
  __resetInstallIdCache,
  getInstallId,
  INSTALL_ID_KEY,
  uuid,
} from '../installId';

function memStore(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: async (k: string) => map.get(k) ?? null,
    setItem: async (k: string, v: string) => void map.set(k, v),
  };
}

beforeEach(() => __resetInstallIdCache());

describe('uuid', () => {
  it('has UUID v4 shape', () => {
    expect(uuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe('getInstallId', () => {
  it('creates and persists a new id when absent', async () => {
    const store = memStore();
    const id = await getInstallId(store);
    expect(id).toBeTruthy();
    expect(store.map.get(INSTALL_ID_KEY)).toBe(id);
  });

  it('reuses the stored id', async () => {
    const store = memStore({ [INSTALL_ID_KEY]: 'fixed-id' });
    expect(await getInstallId(store)).toBe('fixed-id');
  });

  it('caches within the process (no second read hits an empty store)', async () => {
    const store = memStore({ [INSTALL_ID_KEY]: 'fixed-id' });
    await getInstallId(store);
    // 캐시 덕분에 빈 저장소로 바꿔도 같은 값을 반환.
    expect(await getInstallId(memStore())).toBe('fixed-id');
  });
});
