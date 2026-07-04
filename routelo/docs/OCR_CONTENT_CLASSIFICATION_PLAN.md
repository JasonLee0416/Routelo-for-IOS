# 값-형식 기반 필드 분류 — 개선 계획 (Content-first classification)

> R00 더블체크에서 나온 통찰: 라벨 앵커 추출은 레이아웃/방향이 깨지면 실패하지만, **값 자체의
> 형식**이 필드를 강하게 시사한다("6월14일"→배달일, "서울…웨딩홀"→예식장→축하화환).
> 값-우선 분류를 더하면 레이아웃 실패에 강건해지고, 경조사 종류까지 역추론해 교차검증할 수 있다.

## 1. 문제 정의

현재(라벨 앵커): `findLabeledValue(['배달장소', …])` 가 "라벨로 시작하는 줄"을 찾아 값을 뗀다.
- 장점: 레이아웃이 정상이면 정밀.
- 약점: R00처럼 방향/병합이 깨지면 라벨과 값이 다른 행에 흩어져 **전부 미추출**.
  (R00: Apple Vision은 날짜·리본·발주화원·상품명을 다 읽었으나 파서가 하나도 못 꺼냄.)

## 2. 아키텍처 — 3-pass 하이브리드

값-우선 분류를 **추가**하되 기존 라벨 앵커를 대체하지 않는다(둘의 장점 결합).

```
OCR lines
  │
  ├─ Pass A  라벨 앵커 추출        (레이아웃 정상 → 최고 정밀, 기존 로직)
  ├─ Pass B  값-형식 분류기        (라벨 없이 값→필드 후보, 레이아웃 무관)  ← 신규
  └─ Pass C  경조사 종류 추론+교차검증                                     ← 신규
        │
        ▼
  후보 병합·배정 (필드별 best, provenance 보존) → OcrFieldResult[]
```

핵심 원칙: **고신뢰 라벨값(Pass A) > 값-형식 후보(Pass B)**. Pass B는 A가 비운 필드를 채우거나
저신뢰 값을 재랭킹할 때만 개입 → 회귀·오전파 위험 최소화.

## 3. 값-형식 분류기 레지스트리 (필드별 매처 + 신뢰도)

각 OCR 조각(줄)에 대해 "이 값이 어떤 필드일 수 있는가"를 형식으로 점수화한다. 대부분 **기존 함수 재사용**.

| 필드 | 형식/의미 신호 | 재사용 | 신뢰도 |
|---|---|---|---|
| deliveryDate | `YYYY년MM월DD일`·`YYYY.MM.DD`·`MM월DD일` | `matchKoreanDate` | 높음(형식 명확) |
| eventTime | `H시M분`·`HH:MM` + 문맥 `예식/본식/식` | `normalizeKoreanTime` | 중~높음 |
| strictTime | 시각 + `엄수/까지/시간엄수` | `normalizeKoreanTime` | 중 |
| deliveryWindow | `HH:MM~HH:MM` | `parseTimeRange` | 높음 |
| recipientTel / vendorTel | 한국 전화(070·02·01x·15xx) + 문맥(HP/핸드폰→수령·모바일) | `normalizeKoreanPhone` | 높음 |
| deliveryAddress | 지역+장소유형(병원/장례식장/예식장/웨딩홀/호텔)+행정접미사(구/로/층/호) | `scoreAddress` | 중~높음 |
| venueName | 주소 내 장소유형 토큰(…호텔/…웨딩홀/…병원) | 신규(주소에서 추출) | 중 |
| recipientName | 2~4자 한글 + 존칭(고인/상주/신랑/신부) − 업체/주소/지시문 | `extractPersonName` | 중 |
| productName | `축하/근조/화환/난/화분/3단/2단` | 신규(키워드) | 중 |
| productQuantity | `N개`·`수량 N` (1~99) | `normalizeQuantity` | 높음 |
| ribbonText | 경조사 문구 `축화혼/축결혼/삼가/조의/근조/부활/축개업` | 신규(구문) | 중 |
| vendorName | `화원/플라워/㈜/꽃` | `looksLikeVendor`+`cleanVendorName` | 중 |

각 분류기는 `{ field, value(정규화), confidence, sourceText }` 후보를 0~N개 낸다.

## 4. 경조사 종류 추론 (핵심 신규 — 교차검증)

값들의 형식으로 **행사 종류**를 먼저 판정하고, 이를 다른 필드 검증/보정에 쓴다.

```
signals:
  축하(wedding)   ← 예식장/웨딩홀/호텔/그랜드볼룸(venue) · 축화혼/축결혼/축(ribbon) · 축하N단(product)
  근조(condolence)← 장례식장/병원(venue) · 삼가/조의/근조/부활(ribbon) · 근조N단(product)
  개업/기타       ← 축개업 · 개업화환 …
=> eventType = argmax(signal votes)
```

활용:
1. **productName 종류 보정**: eventType=축하인데 productName이 비었거나 "근조"로 오독되면 → "축하화환"으로
   교정/후보 제시. (근조↔축하 OCR 혼동을 다른 신호로 잡음 — 사용자가 지적한 바로 그 흐름.)
2. **ribbon 일관성**: ribbon이 eventType와 모순되면 저신뢰로 강등(검수 유도).
3. **venue ↔ address 연결**: venue 토큰이 있으면 그 줄을 deliveryAddress 후보로 승격.

**안전장치:** eventType 추론은 **저신뢰 필드만 보정**하고, 고신뢰 라벨값은 절대 덮지 않는다.
또 eventType 자체가 저신뢰(신호 상충)면 보정하지 않고 검수로 넘긴다.

## 5. 후보 병합 & 배정

- 모든 pass의 후보를 `{field, value, confidence, source, provenance}` 로 모은다.
- 필드별로 **최고 신뢰 후보 선택**(그리디). 한 값이 여러 필드에 매칭되면 가장 특이도 높은 필드에 우선 배정
  (예: "070-4741-0001"은 전화 확정 → 이름/주소 후보에서 제외).
- **provenance 유지**: 배정된 값의 sourceText가 원본에 존재해야 함(위조 방지 가드 불변).
- 최종적으로 `extractionMethod`에 `format`(값-형식) / `label`(라벨) / `inferred`(교차추론) 표기 →
  검수 UI에서 근거를 보여줄 수 있음.

## 6. 기존 자산 재사용 맵

이미 있는 순수 함수를 "헬퍼"에서 "분류기"로 승격만 하면 됨:
`matchKoreanDate` · `normalizeKoreanTime` · `parseTimeRange` · `normalizeKoreanPhone`/`isValidKoreanPhone`
· `scoreAddress`/`looksLikeAddress` · `extractPersonName`/`classifyEntity` · `normalizeQuantity`
· `cleanVendorName`/`looksLikeVendor` · `scoreValueForType`/`pickBest`. 신규는 productKeyword·ribbonPhrase·
venueExtract·eventType 정도.

## 7. 리스크 & 가드

| 리스크 | 대응 |
|---|---|
| 값 중의성(한 값이 여러 필드) | 신뢰도 임계 + 특이도 우선 배정 + 라벨값 우선 |
| eventType 오추론 전파 | 저신뢰 필드만 보정, eventType 저신뢰면 미보정 |
| 8장 과적합 | 형식 규칙은 **도메인 일반**(정규식·키워드 사전)만, 특정 값 하드코딩 금지 |
| 위조 유입 | 배정 값은 원본 substring 추적(provenance) 필수 |
| 회귀 | Pass A 결과는 그대로 두고 B/C는 "빈 필드 채움/저신뢰 재랭킹"으로 한정 |

## 8. 테스트 전략

- **분류기 유닛테스트**: 형식별 입력→기대 필드/값 (날짜·시간·전화·주소·이름·수량·상품·리본·eventType).
- **레이아웃-무관 회복 측정**: R00 등 Vision 데이터를 값-우선 경로로 파싱해 **라벨 없이도** 배달일·상품·
  주소·리본이 회복되는지 before/after (visionBenchmark 확장).
- **교차검증 테스트**: venue=웨딩홀 → eventType=축하 → productName 종류 보정 케이스.
- **회귀 가드**: 기존 218+ 테스트·DEMO·데이터셋(위조 방지) 불변 확인.

## 9. 단계 (phasing)

- **Phase 1 — 값-우선 폴백.** 라벨 앵커가 비운 필드에 한해 값-형식 분류기로 채움(date/time/phone/address/
  product/quantity/ribbon). R00처럼 레이아웃 깨진 케이스의 미추출을 대폭 회복. (낮은 위험, 큰 효과)
- **Phase 2 — 경조사 종류 추론 + 교차검증.** eventType 판정 → productName/ribbon 보정·일관성 검사.
- **Phase 3 — 후보 병합/배정 프레임워크 + 신뢰도 재랭킹.** Pass A/B/C를 하나의 candidate ranker로 통합,
  `extractionMethod`/근거를 검수 UI에 노출.

## 10. 기대 효과

- **레이아웃/방향 실패에 강건** — R00 유형(Vision은 읽었으나 파서가 못 꺼냄)을 라벨 없이 회복.
- **경조사 종류 자동 분류** — 사용자가 원한 "형식 보고 축하/근조 구분" 실현 → 검수 부담↓.
- **표 컬럼 재구성(큰 작업)의 상당 부분을 우회** — 값-형식만으로 필드가 서면, 완전한 격자 복원 없이도
  실사용 필드 정확도가 오른다.

---

*이 문서는 R00 실측(정답 대조)에서 도출한 값-형식 분류 설계다. Phase 1부터 순수 TS + 테스트로 구현하며
Vision 데이터로 before/after를 실측한다.*
