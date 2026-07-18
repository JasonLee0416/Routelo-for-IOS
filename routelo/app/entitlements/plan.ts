// 요금제 자격(entitlement). 지금은 결제를 붙이지 않고 게이팅 뼈대만 둔다.
// Phase 2에서 plan 소스를 RevenueCat 엔타이틀먼트로 갈아끼우면 그대로 동작한다.

export type AppPlan = 'free' | 'pro';

export type ProFeature =
  | 'unlimitedScans'
  | 'multiVehicle'
  | 'detailedRevenueReport'
  | 'dataExport'
  | 'cloudBackup'
  | 'advancedRoute';

// 무료 티어 하루 스캔 한도(베타 동안 넉넉히). Pro는 무제한.
export const FREE_DAILY_SCAN_LIMIT = 5;

export const PRO_FEATURES: Array<{
  id: ProFeature;
  label: string;
  desc: string;
}> = [
  {
    id: 'unlimitedScans',
    label: '무제한 인수증 스캔',
    desc: `무료는 하루 ${FREE_DAILY_SCAN_LIMIT}건까지`,
  },
  { id: 'multiVehicle', label: '다중 차량 관리', desc: '차량별 주유·수익 분리' },
  { id: 'detailedRevenueReport', label: '상세 수익 리포트', desc: '기간별 분석·비교' },
  { id: 'dataExport', label: '데이터 내보내기(CSV)', desc: '배송·수익 기록 export' },
  { id: 'cloudBackup', label: '클라우드 백업·동기화', desc: '기기 변경에도 안전' },
  { id: 'advancedRoute', label: '고급 동선 최적화', desc: '시간창 기반 최적 순서' },
];

// 기존 저장본 호환: 명시된 plan이 없으면 베타 파운딩 멤버로 보고 Pro를 연다.
// (정식 유료화 시 이 기본값을 'free'로 바꾸고 실제 결제 자격을 소스로 삼는다.)
export function resolvePlan(source?: { plan?: AppPlan }): AppPlan {
  return source?.plan === 'free' ? 'free' : 'pro';
}

export function isFeatureEnabled(plan: AppPlan, _feature: ProFeature): boolean {
  // 현재 모든 Pro 기능은 pro 전용. 무료는 잠금(+한도).
  return plan === 'pro';
}

export function canScan(plan: AppPlan, todayCount: number): boolean {
  return plan === 'pro' || todayCount < FREE_DAILY_SCAN_LIMIT;
}

export function remainingFreeScans(plan: AppPlan, todayCount: number): number {
  if (plan === 'pro') return Infinity;
  return Math.max(0, FREE_DAILY_SCAN_LIMIT - todayCount);
}
