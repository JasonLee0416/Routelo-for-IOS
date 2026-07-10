# 시간창(Time-Window) 최적화 — 기능 설계

> 작성 2026-07-10. 근거: `COMPETITIVE_GAP_ANALYSIS.md` §3 우선순위 1위(최대 갭).
> 목표: 예식/발인 시각을 **정렬 표시가 아니라 경로 순서를 결정하는 제약**으로 승격한다.
> 화환 배달의 핵심 가치("예식/발인 시각 엄수")를 동선 최적화에 직접 반영한다.

## 1. 문제 정의 (현재 구현의 한계)

- `services/maps.ts optimizeByNearestNeighbor`: **직선거리(haversine) 그리디 NN**. 시간을 전혀 고려하지 않음.
- `services/maps.ts geocodeAddress`: **스텁**(주소 문자 합 해시로 서울 근처 가짜 좌표 생성) → 실제 좌표/실도로 거리 없음.
- 동선 화면: NN 시드 + 사용자 수동 재정렬. 시간엄수는 홈 대시보드 "우선표시"와 배달 목록 "마감순 정렬"로만 노출.
- 결과: **"11시 예식 화환"과 "오후 늦어도 되는 화환"이 거리만으로 섞여**, 기사가 수동으로 시간 맞춰 재정렬해야 함.
  경쟁 앱(Onfleet "Always arrive on time")은 시간창을 넘기는 작업을 경로에서 제외/경고한다.

## 2. 데이터 (이미 존재하는 필드 재사용)

`domain/models.ts`의 주문 모델에 시간창 재료가 이미 있다:
- `schedule.strictDeadlineAt` — 엄수 마감 시각(ISO). 화환의 "이 시각까지 반드시".
- `schedule.eventAt` — 예식/발인 시각. 사실상 `strictDeadlineAt`의 상한.
- `schedule.deliveryWindow?{start,end}` — 배달 허용 시간창.
- `destination.latitude/longitude` — 현재는 스텁 좌표. 실좌표는 지오코딩(별도 P0) 이후.
- `status` — pending/completed. 완료 건은 최적화 대상 제외.

→ **하드 데드라인 우선순위**: `strictDeadlineAt` ?? `deliveryWindow.end` ?? `eventAt`.
   **소프트 시작**: `deliveryWindow.start`(그 전엔 도착해도 대기).

## 3. 3단계 설계 (좌표 정확도에 비례해 강화)

시간창 최적화는 실좌표/실도로 ETA가 없어도 **시간만으로 1차 가치**를 낸다. 그래서 지오코딩 완성을
기다리지 않고 단계적으로 도입한다.

### Phase A — EDD(Earliest-Deadline-First) + 실현가능성 플래그  ← 지금 구현 가능
좌표 정확도에 의존하지 않는 순수 시간 기반.
- **정렬 규칙**: 하드 데드라인 오름차순(EDD). 데드라인 동률/무한(마감 없음)이면 기존 NN 거리로 tiebreak.
- **실현가능성 검사**: 시작 시각 T0(현재 또는 근무 시작)부터, 각 정지에
  `이동추정 + 서비스시간(기본 상수, 예 8분)`을 누적해 도착 예상 시각을 계산.
  - 이동추정: 실도로 없으면 `haversine × 도심 평균속도(예 18km/h)` 또는 정지당 상수(예 12분).
  - 도착 예상 > 하드 데드라인 → **`atRisk`(지각 위험)** 플래그.
  - `deliveryWindow.start`보다 이르면 대기(early) — 순서 유지하되 표시.
- **출력**: `{order: Delivery[], perStop: {etaGuess, deadline, atRisk, slackMin}[]}` — 순수 함수.
- **UX**: 동선 목록에 시간창 배지(예 "11:00 예식 · 여유 25분") + `atRisk` 빨강 경고.
  "시간 우선 / 거리 우선" 토글(기본 시간 우선).

### Phase B — 시간창 삽입(greedy insertion)  ← 지오코딩(실좌표) 이후
실좌표가 생기면 거리와 시간을 함께 최소화.
- 각 정지를 "데드라인 위반 없이 총 이동거리 증가가 최소인 위치"에 삽입(그리디 insertion).
- 위반 불가피한 정지는 순서 끝으로 밀고 `atRisk` 유지(사용자 판단에 위임 — 자동 제외는 하지 않음).
- 목적함수 토글: 지각 최소화 → 거리 최소화(2차).

### Phase C — "정시 도착" 제약 솔버  ← 실도로 ETA(교통) 이후
Onfleet 표준에 대응.
- 실도로/교통 ETA로 시간창을 엄격 제약화. 못 맞추는 정지는 **경로에서 분리**해 별도 "위험" 섹션으로
  노출(자동 삭제 아님 — 화환은 누락이 치명적이라 '제외'가 아니라 '경고 분리'로).

## 4. 인터페이스 초안 (Phase A)

```ts
// services/timeWindow.ts (신규, 순수 함수)
export type StopPlan = {
  delivery: Delivery;
  deadline: string | null;      // 하드 데드라인 ISO (없으면 null)
  etaGuess: string;             // 도착 예상 ISO
  slackMin: number | null;      // 데드라인 - 도착예상 (분). 음수면 지각
  atRisk: boolean;              // slackMin < 0
  early: boolean;               // deliveryWindow.start 이전 도착
};
export function planByTimeWindow(
  deliveries: Delivery[],
  opts: { startAt: string; startAtLatLng?: LatLng;
          serviceMin?: number; avgSpeedKmh?: number; mode?: 'time'|'distance' },
): { order: Delivery[]; stops: StopPlan[]; riskCount: number };
```

- `mode: 'time'`(기본) → EDD; `'distance'` → 기존 NN. 둘 다 실현가능성 플래그는 동일 계산.
- 완료(status==='completed') 및 숨김 건은 입력에서 제외.

## 5. 테스트 계획 (순수 함수 → 단위 테스트 용이)

- EDD 정렬: 데드라인이 뒤섞인 입력 → 마감 오름차순, 무마감은 뒤로.
- 실현가능성: 촘촘한 데드라인 3건에 상수 이동/서비스시간 → 정확한 `atRisk`/`slackMin`.
- tiebreak: 동일 데드라인 2건 → 거리 가까운 것 먼저.
- 회귀: 마감 없는 기존 데이터는 NN과 동일 순서(하위호환).

## 6. 롤아웃

1. **Phase A 구현**(순수 `services/timeWindow.ts` + 단위 테스트) → 동선 화면 배지/경고/토글 연결.
2. 지오코딩(P0) 완성 후 Phase B 삽입 알고리즘.
3. 실도로 ETA(P0) 후 Phase C 정시도착 제약.

## 7. 리스크 / 비결정

- **가짜 좌표 의존**: Phase A는 좌표 없이도 EDD로 가치를 내지만, 거리 tiebreak는 스텁 좌표라 부정확.
  → tiebreak 비중을 낮추고 시간 우선을 기본으로.
- **서비스/이동 시간 상수의 현실성**: 초기 상수는 사용자 설정(설정 화면)으로 조정 가능하게.
- **자동 제외 금지 원칙**: 화환은 누락이 치명적 → 어떤 단계도 정지를 '삭제'하지 않고 '위험 분리/경고'만.
