// 자격 결정 로직(순수 함수). 원격 조회 결과와 현재 로컬 요금제를 받아 "적용할
// 요금제 + 출처"를 계산한다. 부수효과(자기등록/저장)는 오케스트레이터가 담당한다.
import { DEFAULT_MEMBER_PLAN } from './config';
import {
  EntitlementResolution,
  FetchResult,
  MemberPlan,
} from './schema';

export function normalizeMemberPlan(
  value: unknown,
  fallback: MemberPlan = DEFAULT_MEMBER_PLAN,
): MemberPlan {
  return value === 'pro' ? 'pro' : value === 'free' ? 'free' : fallback;
}

// 결정 규칙:
//  - found  : 원격이 권위. 운영자가 지정한 plan을 그대로 적용(승격/강등 모두).
//  - absent : 온라인이나 미등록 → 관리 모드 기본(무료)로 자기등록 예정. plan=기본.
//  - error  : 네트워크/서버 오류 → 다운그레이드 금지. 마지막 로컬(=직전 동기화)을 유지.
export function resolveEntitlement(
  fetch: FetchResult,
  localPlan: MemberPlan,
): EntitlementResolution {
  if (fetch.status === 'found') {
    return { plan: normalizeMemberPlan(fetch.record.plan), source: 'remote' };
  }
  if (fetch.status === 'absent') {
    return { plan: DEFAULT_MEMBER_PLAN, source: 'self-registered' };
  }
  return { plan: localPlan, source: 'cache' };
}
