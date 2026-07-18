import AsyncStorage from '@react-native-async-storage/async-storage';

import { getInstallId } from '../device/installId';
import {
  DEFAULT_MEMBER_PLAN,
  MEMBERSHIP_CONFIG,
  isMembershipConfigured,
} from './config';
import { fetchMember, registerMember } from './firestore';
import { resolveEntitlement } from './resolve';
import { EntitlementResolution, MemberPlan } from './schema';

// 회원 자격 오케스트레이터. 설정(config)이 있을 때만 원격 자격을 조회하고,
// 미등록이면 자기등록(무료)한다. 설정이 비어 있으면 완전 무동작 → 기존 로컬
// (파운딩 Pro) 동작 그대로.
export { isMembershipConfigured } from './config';
export type { MemberPlan, EntitlementResolution } from './schema';

export async function getDeviceId(): Promise<string> {
  return getInstallId(AsyncStorage);
}

// 앱 실행/포그라운드 시 호출. 반환된 plan이 현재와 다르면 호출측이 설정에 반영한다.
export async function syncEntitlement(input: {
  label: string;
  localPlan: MemberPlan;
}): Promise<EntitlementResolution> {
  if (!isMembershipConfigured()) {
    return { plan: input.localPlan, source: 'local' };
  }
  const deviceId = await getInstallId(AsyncStorage);
  const result = await fetchMember(MEMBERSHIP_CONFIG, deviceId);

  if (result.status === 'absent') {
    // 미등록 → 관리 모드 기본(무료)으로 자기등록. 승격은 운영자가 콘솔에서.
    await registerMember(MEMBERSHIP_CONFIG, {
      deviceId,
      label: input.label.slice(0, 40),
      plan: DEFAULT_MEMBER_PLAN,
      updatedAt: new Date().toISOString(),
    }).catch(() => undefined);
  }

  return resolveEntitlement(result, input.localPlan);
}
