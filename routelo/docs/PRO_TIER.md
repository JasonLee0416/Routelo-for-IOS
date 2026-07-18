# 요금제(무료/Pro) 게이팅

전략 문서(`GTM_MONETIZATION_STRATEGY.md`)의 프리미엄 모델을 앱 구조로 구현한 것.
**결제는 아직 붙이지 않는다** — 자격(entitlement) 게이팅 뼈대만 두고, 베타 테스터는
"파운딩 멤버 = Pro 무료"로 연다. 정식 유료화 때 plan 소스만 RevenueCat으로 교체.

## 구조
- `app/entitlements/plan.ts` — `AppPlan('free'|'pro')`, Pro 기능 카탈로그, 무료 한도,
  `resolvePlan`(미지정=Pro=파운딩), `canScan`/`remainingFreeScans`.
- `app/entitlements/usage.ts` — 하루 스캔 횟수 카운터(자정 리셋), 저장소·시계 주입식.
- `settings.entitlement.plan` — 자격 소스(optional, 기본 Pro).

## 현재 게이팅
- **무료**: 하루 인수증 스캔 `FREE_DAILY_SCAN_LIMIT`(=5)건. 초과 시 스캐너 대신 업그레이드 안내.
- **Pro**: 무제한 스캔 + 전 기능. Pro 기능 목록: 무제한 스캔·다중 차량·상세 수익 리포트·
  CSV 내보내기·클라우드 백업·고급 동선.
- 설정 **멤버십** 섹션: 현재 요금제 표시, 기능별 잠금/해제, **무료/Pro 미리보기 토글**,
  무료일 때 남은 스캔 수 + "Pro 알아보기"(관심 측정용 자리).

## 원격 회원 관리(관리 모드) — 1단계 완료
`settings.entitlement.plan`은 여전히 앱 내 게이팅 소스이지만, **운영자가 중앙에서**
그 값을 통제할 수 있는 레이어를 추가했다(`app/membership/*`, Firestore REST).
- **미설정 시 무동작** → 기존 로컬(파운딩 Pro) 그대로.
- **설정 시**: 실행/포그라운드에 `members/{deviceId}` 조회 → 운영자 지정 plan 적용,
  미등록은 무료 자기등록, 오류는 강등 금지. 설정 > 멤버십에서 **내 기기 ID** 노출.
- 상세·운영법은 **[MEMBERSHIP.md](MEMBERSHIP.md)** 참고.

## 정식 유료화(Phase 2) 전환 방법
1. `react-native-purchases`(RevenueCat) 추가, 상품/엔타이틀먼트 구성.
2. `resolvePlan`의 소스를 RevenueCat 엔타이틀먼트(활성 구독 여부)로 교체.
3. `defaults.ts`의 기본 `entitlement.plan`을 `'free'`로 변경(파운딩 멤버는 별도 grant).
4. "Pro 알아보기" 자리에 실제 페이월(구독 화면) 연결.
5. 파운딩 멤버(베타 참여자)는 평생 무료/할인 grant 유지.

## 참고
- 무료 한도·Pro 기능 경계는 실사용 데이터로 튜닝(무료도 "혼자 쓸 만"해야 입소문).
- 순수 로직(plan/usage)은 유닛 테스트로 커버(`app/entitlements/__tests__`).
