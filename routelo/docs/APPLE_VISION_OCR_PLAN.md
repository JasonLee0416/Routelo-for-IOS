# Apple Vision OCR 브리지 — 구현 계획 & 로드맵

> 2026-07-04 OCR 성능 테스트(`OCR_RECEIPT_TEST_2026-07-04.md`)의 1순위 개선안 실행 문서.
> 목표는 “Apple Vision 단독”이 아니라 **Receipt Intelligence Engine** —
> Apple Vision(1차) + 문서 촬영/보정 + 도메인 검증 + CLOVA 동의형 fallback + 벤치마크 루프.

## 0. 왜 Apple Vision이 1순위인가

현재 iOS 인식 우선순위는 **Apple Vision → CLOVA → PP-OCR** 이지만, Apple Vision·CLOVA 인식기가
둘 다 스텁(throw)이라 실제로는 PP-OCR이 임시 대타로 돈다(`IOS_INTERIM_PPOCR_FALLBACK`). 7-04 테스트에서
회전(R04)·검출 누락(R01·R05)이 무너진 근본 원인이 이것이다. Apple Vision은 **무료·온디바이스·프라이버시·
기울기 자동 보정·한글 인쇄체 강함** 이라 이 실패들을 크게 줄일 것으로 기대된다.

## 1. 아키텍처

**로컬 Expo 네이티브 모듈(Swift + ExpoModulesCore).** `modules/` 하위 로컬 모듈은 prebuild 시 자동 링크된다.
네이티브는 **순수 인식기**로만 두고(좌표 변환·후보 병합·정규화·폴백은 TS), 계약을 단순하게 유지한다.

**좌표 계약(정확성 핵심):** downstream(`buildLayoutText`, 필드 파서)은 **소스 픽셀·좌상단 원점**을 기대한다.
Apple Vision은 **정규화(0..1)·좌하단 원점**을 주므로 **Y축 뒤집기 변환**이 필수. 이 변환은 순수 함수로
분리해 유닛테스트로 못박았다(`visionBoxToPixels`).

```
Vision(정규화·좌하단)  ──visionBoxToPixels──▶  앱 계약(픽셀·좌상단)
  y_px = round((1 - (y + h)) * imageHeight)   // ★ 핵심
```

## 2. PR 1 — Apple Vision Bridge ✅ (이 커밋에서 착수)

### 추가/수정된 파일
| 파일 | 역할 | 상태 |
|---|---|---|
| `modules/apple-vision-ocr/ios/AppleVisionOcrModule.swift` | VNRecognizeTextRequest 본체(.accurate, ko-KR/en-US, customWords, EXIF 방향) | 신규(네이티브, 맥 빌드 필요) |
| `modules/apple-vision-ocr/ios/AppleVisionOcr.podspec` | Pod 스펙(iOS 16.0, ExpoModulesCore 의존) | 신규 |
| `modules/apple-vision-ocr/expo-module.config.json` | 자동링크 설정(`apple` 플랫폼) | 신규 |
| `modules/apple-vision-ocr/index.ts` | `requireOptionalNativeModule` 래퍼 + 미가용 시 에러 | 신규 |
| `modules/apple-vision-ocr/package.json` | 로컬 모듈 메타 | 신규 |
| `app/platform/appleVision.ts` | **순수** 좌표변환·payload→`ReceiptRecognizerResult` 매퍼 + 에러 | 신규 |
| `app/platform/receiptRecognizers.ts` | `appleVisionRecognizer.recognize` 스텁 → 실제 구현 | 수정 |
| `app/platform/__tests__/appleVision.test.ts` | 좌표변환·매핑 유닛테스트(6) | 신규 |
| `app/platform/__tests__/receiptRecognition.test.ts` | “미연결” 단언 → “네이티브 미가용 폴백” 단언 | 수정 |

### 네이티브 ↔ JS 계약
```ts
type VisionPayload = {
  imageWidth: number; imageHeight: number;   // 오리엔테이션 적용 후 픽셀
  processingMs: number; osVersion: string;
  lines: Array<{ text: string; confidence: number;
                 box: { x:number; y:number; w:number; h:number } }>; // 정규화·좌하단
};
```
- 네이티브는 Vision 원본 좌표를 그대로 반환 → TS `mapVisionPayloadToResult`가 픽셀·좌상단으로 변환하고
  `cornerPoints`(4점) 생성, 빈 줄 제거, `fullText = lines.join('\n')`, `engine:'apple-vision'`.
- **미가용(Android/web/Jest/미링크 빌드):** `requireOptionalNativeModule`이 null → `AppleVisionUnavailableError`
  throw → 폴백 체인이 CLOVA/PP-OCR로 이동. **절대 가짜 OCR을 만들지 않음.**

### Swift 요점
- `recognitionLevel = .accurate`, `usesLanguageCorrection = true`.
- `recognitionLanguages`는 `supportedRecognitionLanguages()`로 필터(한글은 iOS 16+; 미지원 시 en-US로 축소).
- `customWords` = 도메인 라벨(발주화원·배송화원·배달장소·품명·근조화환 …) → 라벨 인식 강화.
- **EXIF orientation**을 `VNImageRequestHandler(cgImage:orientation:)`에 전달 → 카메라 회전 대응.
- 90/270° 방향이면 오리엔티드 크기로 축 교환하여 정규화 좌표와 픽셀 정합.

### 검증 상태
- **여기(CI/Jest)에서 통과 확인:** 전체 **171 테스트 / 타입체크 그린**(신규 6 테스트 포함). 좌표 Y축 뒤집기·매핑·미가용 폴백 검증됨.
- **맥/시뮬에서 해야 할 것:** `npx expo prebuild` → dev client 빌드 → 사진보관함으로 8장 인식(시뮬 카메라 없음, 사진 권한은 이미 있음). Apple Vision은 Node 재현 불가하므로 **before/after 실측은 시뮬 필수**. R04(회전)·R01(누락) 개선이 성패 지표.
- **빌드 전 확인:** iOS deployment target ≥ **16.0** (한글). 필요 시 `expo-build-properties`로 `ios.deploymentTarget: "16.0"` 지정.

## 3. 로드맵 (PR 2~6) — Receipt Intelligence Engine

PR1로 1차 엔진을 연결한 뒤, 실제 “거의 완벽”은 **실패 조건을 줄이는 전체 시스템**에서 나온다.

### PR 2 — Capture Quality + Document Crop
촬영 단계에서 흔들림·밝기·그림자·기울기 점수화, 문서 외곽선 감지, perspective correction, 재촬영 안내.

### PR 3 — Apple Vision Multi-pass
단일 pass는 흔들림·회전·접힘·작은 숫자에 쉽게 실패. 후보를 **묶음**으로 저장:
```ts
type RecognizedText = {
  engine: 'apple-vision' | 'ppocrv5' | 'clova';
  variant: 'original' | 'deskewed' | 'rotated90' | 'contrast' | 'numeric-crop';
  fullText: string; lines: RecognizedTextLine[]; processingMs: number;
};
```
| Pass | 입력 | 목적 |
|---|---|---|
| A | 원본 고해상도 | 기본 |
| B | 문서 crop + perspective | 메인 후보 |
| C | 90/180/270° 회전 후보 | 방향 오류 방지 |
| D | contrast/sharpen | 흐릿한 숫자·전화번호 |
| E | 숫자 중심 crop | 전화·날짜·시간·수량 |

> PR1 payload는 이 확장과 forward-compatible하게 설계됨(줄 단위 box/confidence 보존).

### PR 4 — Field-aware Parser 강화 (실제 정확도의 핵심) 🚧 값 검증 계층 착수
“글자 인식”보다 **필드 복원**이 중요. `배송지/배달주소/주소/도착지`를 모두 `deliveryAddress`로 모은다.

**이 커밋에서 구현된 값 검증 계층** (`app/ocr/fieldValidation.ts`, 순수 TS, 테스트 21):
- **전화**: `070`(VoIP)·`1566` 대표번호까지 인식 — 기존 파이프라인은 070을 **아예 거부**했음(화훼 인수증 전화의 대부분).
- **날짜**: `2026년 06월 14일`·`06월 14일`(defaultYear) 등 인수증 주력 한글 형식 — 기존은 `2026.06.14`만 처리해 **통째로 누락**했음. 재포맷 값의 원본 매칭 문자열(raw)을 함께 반환해 provenance(위조 방지 추적)를 유지.
- **시간**: `17시 00분`·`12시20분`·`오후 5시`·범위 `11:00~12:30` 파싱, 00:00~23:59 검증.
- **수량**: 1~99, `수량 100` 오추출 가드.
- **교차 필드 충돌 검사**: 배송 시간대 역전, 엄수>예식 시간 → 검수 UI 강조.
- 서비스(`services/ocr.ts`)가 로컬 약한 검증을 이 공용 모듈로 위임하도록 통합. 전체 192 테스트 그린.

**남은 작업(PR4 후속):** 앵커-값 재랭킹(`scoreValueForType` 활용), 주소 heuristic(시/구/로/길/동), 업체 vs 수령자 disambiguation, 후보 병합.

| 필드 | 인식 앵커 | 검증 규칙 |
|---|---|---|
| 발주화원 | 발주화원·발주처·발주회원 | 업체명 2자+, 전화 있으면 가산 |
| 배송화원 | 배송화원·수주화원·배송처 | 업체명/전화 쌍 |
| 배송일 | 배송일·배달일 | `YYYY-MM-DD`·`M월 D일` 정규화 |
| 엄수/예식 시간 | 시간엄수·엄수·예식·본식 | 00:00~23:59, 충돌 검사 |
| 배송주소 | 배송주소·배달주소·주소·배송지 | 시/구/로/길/동/층 키워드 |
| 수령자 | 받는분·수령인·인수자 | 업체명·화원 제외 |
| 연락처 | 전화·연락처·핸드폰 | 한국 전화 regex |
| 상품명 | 상품명·품명·배송상품 | 축하/근조/화환/난 |
| 수량 | 수량·개수 | 1~99 |
| 리본문구 | 리본문구·경조사어 | 긴 문장 허용 |

> **원칙: OCR confidence보다 field validation을 더 신뢰.** confidence가 높아도 전화번호가
> `010-123-45`처럼 규칙 위반이면 낮은 후보로 강등.

### PR 5 — CLOVA 동의형 fallback
인수증엔 수령자 이름·전화·주소가 있으므로 **자동 cloud 전송 금지.** 아래 조건에서만 사용자 동의 후 호출:
- 필수 필드(배송일/상품명/배송주소) 누락, 문서 confidence < 82, 전화 검증 실패, 시간 충돌,
  Apple Vision↔PP-OCR 후보 큰 차이, 또는 사용자가 “정확도 보정” 버튼.
- **자동 덮어쓰기 금지**, 후보 병합만.

### PR 6 — Benchmark System
실제 인수증 100장부터 field-level ground truth 작성 → Apple Vision/PP-OCR/CLOVA 비교(CER, field F1, 필수필드 성공률).

## 3.5 자체 모델(딥러닝) 전략 — “OCR”이 아니라 “필드 추출”

**결정: iOS에서 자체 OCR 모델을 딥러닝으로 학습하지 않는다.** Apple Vision은 애플의 대규모 데이터 +
Neural Engine 가속 + OS 갱신을 등에 업어, 소규모 팀이 범용 한글/영문 인쇄체 인식에서 이길 수 없다.
PP-OCR을 iOS에 얹는 것조차 이미 차선이며, 7-04 테스트의 실패 원인은 “인식 모델이 약해서”가 아니라
검출·기울기·전처리였다(그건 Apple Vision이 내장으로 해결).

**역할 분담:**

| 층 | 담당 | 자체 개발 |
|---|---|---|
| 텍스트 검출 + 인식 | **Apple Vision**(iOS) · PP-OCR/CLOVA(보조) | ❌ 애플이 압도 — 만들지 않음 |
| 도메인 필드 복원 | **우리 코드**(PR4) | ✅ 진짜 승부처 |

애플·CLOVA가 모르는 것은 “이것이 한국 화훼 배송 인수증이고, `배달장소` 옆 값이 `deliveryAddress`이며
전화는 070/010 형식”이라는 **도메인 지식**이다. 여기가 유일한 해자이자 정확도가 결정되는 곳.

**딥러닝을 쓴다면 OCR이 아니라 “필드/레이아웃 추출”에, 그리고 순서가 중요하다:**

1. **1단계(지금): 규칙 + 검증.** 싸고 해석 가능, 라벨 데이터가 거의 없는 현시점에 유일하게 현실적. ← PR4
2. **2단계: 학습 루프.** 검수 UI에서 사용자가 고친 필드를 쌓아 **업체별/서식별 alias·패턴 학습** → 진짜 “우리 도메인” 데이터. ← PR6와 연결.
3. **3단계(선택, 규칙이 한계일 때만): 소형 구조화 추출 모델.** Apple Vision의 텍스트+박스를 입력받아
   receipt→JSON을 뽑는 **문서이해 모델(LayoutLM류)** 또는 소형 LLM 파인튜닝. **OCR CNN이 아님.**
   온디바이스면 Core ML 변환. 2단계 교정 데이터가 쌓인 뒤에만 의미가 생긴다.

> 요약: 최고 성능 경로는 “Apple Vision(인식) + 도메인 파서/검증/검수 루프(정확도)”. 자체 딥러닝은
> OCR을 대체하는 게 아니라 **그 출력을 먹고 필드를 뽑는 후단 모델**이며, 교정 데이터가 전제.

## 4. 정확도 목표 (필드 단위)
| 지표 | 목표 |
|---|---|
| 필수 필드 성공률 | 98%+ |
| 전화번호 정확도 | 99%+ |
| 날짜/시간 정확도 | 98%+ |
| 주소 후보 추출 | 95%+ |
| 자동 등록률 | 0% (검수 필수) |
| 인수증당 사용자 수정 필드 | ≤ 1 |
| CLOVA 호출률 | ≤ 10~20% |

## 5. 플래그 & 롤아웃
- 초기: `IOS_INTERIM_PPOCR_FALLBACK = true` 유지 → 체인 **Apple Vision → CLOVA → PP-OCR(안전망)**.
- 시뮬/기기에서 Apple Vision 안정성 확인 후 주력 유지(PP-OCR은 최후 폴백 존치).
- `receiptRecognitionCapability`는 이미 `apple-vision` 1순위 보고 → 변경 최소.

## 6. 참고 API
- Apple Vision `VNRecognizeTextRequest`(이미지 OCR 핵심), `VNDocumentCameraViewController`(문서 촬영),
  `DataScannerViewController`(실시간 스캔). 한글은 iOS 16+.
- 비교 후보: Google ML Kit v2(한글·bbox·corner·회전·confidence), NAVER CLOVA OCR(기울기/필기체/영수증 모델).

---

*PR1은 본 문서 커밋에 포함(네이티브 파일은 맥 빌드로 검증 필요). PR2~6은 순차 진행하며 7-04 8장으로 회귀 측정한다.*
