import { VendorCandidate, VendorDirectory } from './types';

export type KakaoVendorConfig = {
  restApiKey: string;
  size?: number; // 결과 상한 (기본 5)
  fetchImpl?: typeof fetch;
};

type KakaoDoc = {
  place_name: string;
  phone?: string;
  address_name?: string;
  road_address_name?: string;
  x?: string; // 경도(lng)
  y?: string; // 위도(lat)
  category_name?: string;
  place_url?: string;
};

const toCandidate = (doc: KakaoDoc): VendorCandidate => ({
  name: doc.place_name,
  phone: doc.phone || undefined,
  address: doc.road_address_name || doc.address_name || undefined,
  latitude: doc.y ? Number(doc.y) : undefined,
  longitude: doc.x ? Number(doc.x) : undefined,
  category: doc.category_name || undefined,
  url: doc.place_url || undefined,
});

// 카카오 로컬 키워드 장소검색. 질의(업체명)만 전송한다.
export function createKakaoVendorDirectory(
  config: KakaoVendorConfig,
): VendorDirectory {
  const size = config.size ?? 5;
  const doFetch = config.fetchImpl ?? fetch;
  return {
    id: 'kakao-local',
    async search(query: string): Promise<VendorCandidate[]> {
      const q = query.trim();
      if (!q) return [];
      const url =
        'https://dapi.kakao.com/v2/local/search/keyword.json' +
        `?query=${encodeURIComponent(q)}&size=${size}`;
      const res = await doFetch(url, {
        headers: { Authorization: `KakaoAK ${config.restApiKey}` },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { documents?: KakaoDoc[] };
      return (data.documents ?? []).map(toCandidate);
    },
  };
}

// 키가 없거나 오프라인일 때의 no-op 폴백.
export const NULL_VENDOR_DIRECTORY: VendorDirectory = {
  id: 'null',
  async search() {
    return [];
  },
};

// 설정/환경에서 키를 주입. 없으면 비활성(null) 디렉터리를 돌려준다.
export function resolveVendorDirectory(config?: {
  kakaoRestApiKey?: string | null;
  fetchImpl?: typeof fetch;
}): VendorDirectory {
  const key = config?.kakaoRestApiKey?.trim();
  if (!key) return NULL_VENDOR_DIRECTORY;
  return createKakaoVendorDirectory({
    restApiKey: key,
    fetchImpl: config?.fetchImpl,
  });
}
