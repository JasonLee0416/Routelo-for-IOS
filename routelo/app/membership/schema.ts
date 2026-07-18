// 회원 자격(요금제) 원격 관리. Pro/무료를 운영자가 중앙에서 통제하기 위한 최소
// 데이터 모델. 기기 익명 설치 ID를 문서 키로 쓰고, 사람이 알아볼 별명(label)만
// 함께 저장한다(전화·주소 등 PII는 저장하지 않는다).

export type MemberPlan = 'free' | 'pro';

export type MemberRecord = {
  deviceId: string;
  label: string; // 온보딩 표시 이름(별명). 운영자가 리스트에서 식별용.
  plan: MemberPlan;
  note?: string; // 운영자 메모(선택)
  updatedAt: string; // ISO
};

// 원격 조회 결과의 3상태. absent(미등록)와 error(네트워크/서버)를 구분해야
// 자기등록 여부·다운그레이드 여부를 안전하게 결정할 수 있다.
export type FetchStatus = 'found' | 'absent' | 'error';

export type FetchResult =
  | { status: 'found'; record: MemberRecord }
  | { status: 'absent' }
  | { status: 'error' };

export type EntitlementSource = 'local' | 'remote' | 'self-registered' | 'cache';

export type EntitlementResolution = {
  plan: MemberPlan;
  source: EntitlementSource;
};
