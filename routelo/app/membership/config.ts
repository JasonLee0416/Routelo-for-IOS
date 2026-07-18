// 회원 자격 백엔드 설정. 텔레메트리와 동일하게 Firestore REST를 쓰며 네이티브
// SDK가 없다. Firebase 웹 API 키는 "비밀"이 아니라 프로젝트 식별자일 뿐이고,
// 실제 접근 제어는 Firestore 보안 규칙으로 한다(MEMBERSHIP.md 참고). 아래 값을
// 본인 Firebase 프로젝트 값으로 채우면 관리 모드가 켜진다. 비어 있으면 완전 비활성
// → 기존 로컬(파운딩 Pro) 동작 그대로.
//
// projectId/apiKey는 텔레메트리와 같은 프로젝트 값을 그대로 써도 된다(컬렉션만 분리).
export type MembershipConfig = {
  projectId: string;
  apiKey: string;
  collection: string;
};

export const MEMBERSHIP_CONFIG: MembershipConfig = {
  projectId: '',
  apiKey: '',
  collection: 'members',
};

// 미등록 기기가 처음 온라인 동기화될 때 자기등록되는 기본 요금제.
// 관리 모드에서는 '무료'가 기본이고, 운영자가 리스트에서 Pro로 승격한다.
export const DEFAULT_MEMBER_PLAN = 'free' as const;

export function isMembershipConfigured(
  config: MembershipConfig = MEMBERSHIP_CONFIG,
): boolean {
  return Boolean(config.projectId && config.apiKey);
}
