# OCR 파이프라인 개선 진행 로그 (서사)

> 자율 진행 기록. 각 반복(iteration)마다 **계획(사전) → 구현 → 테스트 결과(사후)** 를 남긴다.
> 목표: 순수 TS 파이프라인 계층(값 검증·heuristic·파서·폴백 결정·벤치마크)을 회귀 없이
> "거의 완벽"에 수렴시킨다. Apple Vision 실인식 정확도는 맥 시뮬에서만 측정 가능(별도).

## 타임라인 요약

| # | 항목 | 상태 | 테스트 |
|---|------|------|------|
| 0 | 7-04 인수증 8장 실측 보고서 | ✅ | — |
| 1 | PR1 Apple Vision 브리지(네이티브) | ✅ 착수(맥 검증 대기) | 171 |
| 2 | PR4 값 검증 계층(전화/날짜/시간/수량/충돌) | ✅ | 192 |
| 3 | PR4 후속(주소 heuristic·업체vs수령자·재랭킹) | ✅ | 204 |
| 4 | PR4-c 업체명 정제 + 업체↔전화 페어링 | ✅ | 207 |
| 5 | PR5 클라우드 폴백 결정 로직(동의형) | ✅ | 212 |
| 6 | PR6 벤치마크 하네스(필드 성공률 지표) + productName 정제 | ✅ | 215 |
| 7 | Apple Vision 측정 키트(macOS CLI + before/after 하네스) | ✅ | 217 |
| 8 | Apple Vision 실측 + 방향 자동 보정(회전 사진) | ✅ | 217 |
| 9 | 방향 tiebreak + 수령자 존칭 접두어 처리 | ✅ | 218 |

---

## Iter 4 — PR4-c: 업체명 정제 + 업체↔전화 페어링

### 계획 (사전)
- 문제: 업체(발주/배송 화원, 예식장) 필드에 라벨 뒤 값이 그대로 들어가 전화/군더더기가 섞이거나,
  사람이름/주소가 오배정될 수 있음. 또 업체와 전화가 같은/인접 줄에 있을 때 쌍으로 검증되지 않음.
- 해결:
  1. `cleanVendorName(raw)`: 값에서 전화번호·괄호코드·라벨 잔여를 제거하고 업체명만 남긴다.
  2. `looksLikeVendor` 강화로 업체 필드가 사람이름/주소만인 값을 걸러낸다(disambiguation 반대방향).
  3. 업체 전화: 업체명 줄 또는 인접 줄에서 전화 후보를 페어링(`pickTypedValue('tel', ...)`).
- 순수 TS + 테스트로 검증, 서비스 통합 후 전체 그린 확인.

### 구현
- `fieldHeuristics.cleanVendorName(raw)`: 전화(`KOREAN_PHONE_PATTERN`)·`TEL/HP/FAX/전화` 이후·구분자 제거,
  주소로 판별되면 '' (상호 아님), 한글/영문 없으면 '' 반환.
- 서비스: `orderingVendorName`/`fulfillingVendorName`을 `cleanVendorName`으로 정제해 필드에 사용.
- 업체 전화 페어링: 라벨 전화가 없으면 `vendorPhoneFromLine`이 업체명 줄에서 유효 전화를 추출해 채움.

### 테스트 결과 (사후)
- 신규 테스트 3(cleanVendorName). **전체 207 통과(35 스위트), 타입체크 클린.** 회귀 0.
- 효과: `㈜99플라워 070-4741-0001` → 상호 `㈜99플라워` + 전화 `070-4741-0001` 로 분리 정제.

---

## Iter 5 — PR5: 클라우드(CLOVA) 폴백 결정 로직 (동의형)

### 계획 (사전)
- CLOVA OCR는 한국어 영수증에 강하지만 인수증엔 개인정보(수령자·전화·주소)가 있어 **자동 전송 금지**.
  "언제 2차 보정을 제안할지"를 결정하는 **순수 로직**만 먼저 구현(HTTP 어댑터·동의 UI는 별도).
- `shouldRequestCloudFallback({ fields, documentConfidence, conflicts })` →
  `{ trigger, reasons }`. 트리거: 필수필드(배송일/상품명/배송주소) 누락, documentConfidence < 82,
  전화 검증 실패, 시간 충돌 존재, (후속) 엔진 간 후보 큰 차이.
- 파이프라인 결과에 **제안만** 부착(자동 실행 아님). 순수 TS + 테스트.

### 구현
- `app/ocr/cloudFallback.ts`: `shouldRequestCloudFallback({fields, documentConfidence, conflicts})`
  → `{trigger, reasons}`. 트리거: 필수필드 누락, `documentConfidence < 82`, 필드 검증 실패, 시간 충돌.
- `OcrPipelineResult`에 `conflicts`·`cloudFallback` 필드 추가(자동 실행 아님, 제안만).
- `parseReceiptText`가 `detectFieldConflicts` + `shouldRequestCloudFallback`를 계산해 결과에 부착.
- UI 빈 상태 리터럴에도 기본값 채움.

### 테스트 결과 (사후)
- 신규 테스트 5(cloudFallback). **전체 212 통과(36 스위트), 타입체크 클린.** 회귀 0.
- 자동 cloud 전송은 여전히 금지 — 이 로직은 "제안"만 생성, 실제 호출은 동의+어댑터(후속).

---

## Iter 6 — PR6: 벤치마크 하네스 (필드 성공률 지표화)

### 계획 (사전)
- "거의 완벽"을 측정 가능하게: 정답(ground-truth) 픽스처 대비 **필드 단위 성공률**을 계산하는 순수 함수
  `computeFieldMetrics(expected, actual)` → per-field 정오 + 필수필드 성공률 + 전체 정확도.
- 픽스처: DEMO 인수증(테스트에 이미 존재)의 정답값을 명시 → parseReceiptText 결과와 대조.
- 회귀 가드: 필수필드 성공률·핵심 필드 정확도에 **하한 임계값** 단언(미래 변경이 정확도를 떨어뜨리면 실패).
- 순수 TS + 테스트. 이후 실제 100장 데이터셋으로 확장(학습 루프 진입점).

### 구현
- `app/ocr/benchmark.ts`: `computeFieldMetrics(expected, actual)` → 필드별 정오 + `accuracy` +
  `requiredAccuracy`(배송일/상품명/배송주소) + `wrong` 목록.
- `benchmark.test.ts`: 클린 인수증 정답 픽스처(15필드) 대비 parser 결과 대조. **회귀 가드**로
  `requiredAccuracy === 1`·`accuracy === 1`·`cloudFallback.trigger === false` 단언.
- 부수 개선: 상품명 뒤 수량("… 2개") 제거 → `축하 3단 화환` (수량은 `productQuantity`로 분리).

### 테스트 결과 (사후)
- 신규 테스트 3(benchmark). **전체 215 통과(37 스위트), 타입체크 클린.** 클린 텍스트 필드 정확도 **15/15 = 100%**.

---

## 현재 상태 & 다음 단계

**순수 TS 파이프라인 계층은 포괄적으로 그린(215 테스트).** 값 검증(전화 070/대표번호·한글 날짜·시간·
수량·충돌) · heuristic(주소·업체vs수령자·재랭킹) · 업체명 정제/전화 페어링 · 폴백 결정 · 벤치마크 하네스까지.
클린 인수증 필드 정확도는 벤치마크로 100%가 고정(회귀 방어).

**여기서 더 "완벽"에 가까워지려면** 둘 중 하나가 필요하다:
1. **맥 시뮬에서 Apple Vision(PR1) 실인식** → 실제 노이즈 있는 8장에 대한 before/after 측정(리눅스에서 불가).
2. **노이즈 입력 벤치마크 픽스처** → 7-04 실측 OCR 텍스트 + 사용자 정답 라벨로 messy-input 성공률을 지표화
   (필드 정답 라벨링이 전제 — 사용자 채점과 연결).

즉 순수 로직 계층은 사실상 상한에 도달했고, 다음 정확도 향상은 **실기기/실인식 데이터**에서 나온다.

---

## Iter 7 — Apple Vision 측정 키트 (before/after)

### 계획 (사전)
- Apple Vision(PR1)이 노이즈 8장에서 PP-OCR 대비 나은지 **맥에서 시뮬/앱빌드 없이** 측정.
  `VNRecognizeTextRequest`는 macOS 네이티브 → 명령줄 Swift로 앱과 동일 설정으로 실행 가능.

### 구현
- `tools/vision-ocr/vision-ocr.swift`: macOS Vision CLI(모듈과 동일 설정) → `vision-results.json`.
- `docs/ocr-benchmark/2026-07-04/pp-ocr-lines.json`: 7-04 실측 PP-OCR 라인 = "before" 픽스처.
- `app/ocr/__tests__/visionBenchmark.test.ts`: 두 엔진 라인을 `buildLayoutText`+`parseReceiptText`에
  통과시켜 필드 추출을 비교. Vision JSON 없으면 baseline만 출력(현재), 있으면 before/after 표.
- `tools/vision-ocr/README.md`: 맥 실행 런북.

### 테스트 결과 (사후)
- **전체 217(216 통과 + 1 skip=Vision 대기), 타입체크 클린.** 하네스가 PP-OCR baseline을 산출:
  필수필드 채움 **총 9/24** (R01·R04·R05 = 0/3 — 검출 붕괴). 이것이 "before" 기준선.
- **다음(맥):** `swift tools/vision-ocr/vision-ocr.swift KakaoTalk_*.jpg > .../vision-results.json`
  → `npx jest visionBenchmark` → "after" 열이 채워지며 R04(회전)·R01/R05(누락) 회복 여부가 성패 지표.

---

## Iter 8 — Apple Vision 실측 결과 + 방향 자동 보정

### 실측 (사용자 맥에서 Vision CLI 실행 → JSON 수신)
- **raw OCR: Apple Vision 압도.** 8장 전부 텍스트를 다 잡음(총 306줄). PP-OCR이 완전히 무너졌던
  R01/R04/R05도 31/43/38줄 인식. `06월 14일(일) 11:00~12:30`, `영등포구 가마산로 538 …`,
  `070-8277-1211`, `고대구로병원 장례식장 105호실` 등 통짜로 정확.
- **그러나 필드 파서가 뭉갬(중요 발견).** 이 사진들은 EXIF로 90° 회전 → Vision이 세로 프레임에서
  인식 → 박스가 세로로 길어(가로 행 가정하는 `buildLayoutText`가 못 묶음) → `주소`/`상품명`에
  영수증 전체가 덤프. **병목이 OCR → 레이아웃/방향 복원으로 이동.**

### 구현 — 방향 자동 보정 (`app/ocr/orientation.ts`)
- 텍스트 박스가 "세로로 길면"(median 종횡비 < 0.8) 회전으로 판단, none/cw/ccw 중 **라벨이 행
  머리에 가장 많이 오는 방향**(=파싱 적합도 최대)을 선택해 좌표를 되돌린다.
- 정상 방향 영수증은 "none" → 기존 파이프라인 무변(회귀 0). `buildLayoutText` 앞단에 연결.

### 테스트 결과 (사후)
- **전체 217 통과, 타입체크 클린.** vision-results.json을 저장소에 고정 → visionBenchmark가
  상시 before/after 회귀 가드로 동작.
- **필수필드(배송일/상품명/배송주소): PP-OCR 9/24 → Apple Vision 19/24 (+111%).**
  보정으로 R02·R03·R04·R06가 3/3 달성, 주소가 깨끗하게 복원(중앙대병원/선유로101/보라매병원/고려대구로병원).
- **남은 것:** R00·R01·R05는 방향 선택이 아직 불완전(라벨 열이 좌우 반대이거나 행 병합 잔재).
  수령자/연락처는 라벨 행 복원이 덜 되어 미추출 → 후속 파서/방향 튜닝 대상.

### 결론
Apple Vision이 iOS 주력 인식기로서 **명백히 우월**함이 실측으로 확정(9→19). 이제 정확도의 다음
상한은 **회전/레이아웃 복원 + 라벨-값 행 재구성**에 있으며, 모두 순수 TS로 이어갈 수 있다.

---

## Iter 9 — 방향 tiebreak + 수령자 존칭 처리

### 계획 (사전)
- Iter8 진단: 8장 모두 정답 방향이 ccw인데 R00·R05는 점수 동점이라 'none'이 뽑혀 미보정.
  수령자 이름이 존칭 접두어("고 박희순", "받는분 고인 심명철")로 미추출.

### 구현
- `orientation.ts`: 회전 확정 시(median 종횡비<0.8) 후보에서 **'none' 제외**, ccw를 먼저 두어
  동점 시 ccw 선택(한 방향 촬영에서 ccw 지배적).
- `fieldHeuristics.extractPersonName`: `stripRolePrefixes`로 역할/존칭 접두어를 **반복 제거**
  (고/故/고인/상주/신랑/신부/받는분 …), 직함(실장 등)은 보존.

### 테스트 결과 (사후)
- 신규 테스트 1(존칭). **전체 218 통과, 타입체크 클린.** 필수필드 19/24 유지, R00/R05 방향 보정
  적용(상품명·주소 일부 개선), `extractPersonName`은 존칭 케이스 전부 정확.

### 남은 진짜 과제 (다음 상한, 더 큰 작업)
- **표 컬럼 재구성.** 방향을 고쳐도 `buildLayoutText`가 표의 여러 라벨-값 쌍을 한 행으로 뭉쳐
  (예: R05 "보내는분 배달장소 리본 이 대목동병원…"), `findLabeledValue`가 "받는분"으로 시작하는
  행을 못 찾아 수령자/연락처가 미추출. **2열(라벨|값) 격자 인지 + 셀 단위 분리**가 필요 —
  단순 y-행 그룹핑을 넘어서는 구조 복원 작업(향후 별도 반복).
- R00·R01·R04 일부는 방향/병합 잔재로 주소에 군더더기. 컬럼 재구성과 함께 개선 예상.
