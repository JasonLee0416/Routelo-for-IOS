// 발주처(업체) 온라인 교차검증을 위한 타입과 프로바이더 계약.
// 핵심 가드레일: 네트워크로 나가는 것은 "업체명"(과 선택적으로 업체 전화)뿐이며,
// 수령인 이름/전화/주소 같은 개인정보(PII)는 절대 전달되지 않는다.

export type VendorCandidate = {
  name: string;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  category?: string;
  url?: string;
};

export type VendorVerificationStatus =
  | 'confirmed' // 이름 강매칭 또는 전화 일치
  | 'ambiguous' // 약매칭 — 후보 중 사용자가 선택
  | 'notFound' // 결과 없음/약함
  | 'skipped'; // 비활성(키 없음/오프라인)·질의 부적합

export type VendorVerification = {
  status: VendorVerificationStatus;
  query: string;
  best?: VendorCandidate;
  candidates: VendorCandidate[];
  score: number; // 최고 후보의 이름 유사도 (0..1)
  phoneMatched: boolean;
  reason?: string;
};

// 프로바이더 계약(recognizer 계약과 동일 패턴). 구현은 카카오/구글/네이버 등.
export interface VendorDirectory {
  readonly id: string;
  search(query: string): Promise<VendorCandidate[]>;
}
