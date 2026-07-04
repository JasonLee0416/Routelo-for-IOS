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
| 7 | Apple Vision 측정 키트(macOS CLI + before/after 하네스) | ✅ 맥 실행 대기 | 217 |

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
