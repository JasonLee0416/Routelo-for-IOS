# Routelo for iOS — 아키텍처

로컬 우선 · 계층 분리 · 순수 코어(테스트) + 얇은 UI. React Native(Expo) 앱.

## 1. 계층 구조

```
┌────────────────────────────────────────────────────────────┐
│ ① 부팅        index.ts → App.tsx(SafeAreaProvider)          │
│               → RouteloApp (루트 상태 · 테마 · 온보딩)       │
├────────────────────────────────────────────────────────────┤
│ ② 화면(UI)    홈 · 배달 · 동선 · 손익(일정) · 알림 · 설정    │
│               + 상세 시트 / 폼 모달 / 스캐너 (app/index.tsx) │
│               조작 레이어는 LUCENT GlassSurface (app/theme)  │
├────────────────────────────────────────────────────────────┤
│ ③ 서비스      순수 로직 (app/services) — 화면이 호출         │
│   검색/정렬 · 통계 · 손익/버킷 · 주유 · 계기판 · 연비 ·      │
│   백업 · 내보내기 · 전화 · 마감 · 금액 · 경로 · 내비 ·       │
│   알림 계획(notificationPlan) · OCR                          │
├────────────────────────────────────────────────────────────┤
│ ④ 도메인      DeliveryOrder · ReceiptDocument · RoutePlan ·  │
│   (app/domain) 수동주문 · 달력 · legacy 어댑터 (무손실)      │
├────────────────────────────────────────────────────────────┤
│ ⑤ 저장        Repository 계약(contracts) + Local 구현        │
│   (app/repositories) → AsyncStorage (로컬 우선, 샘플 없음)   │
├────────────────────────────────────────────────────────────┤
│ ⑥ 외부        내비 앱 딥링크(티맵·카카오·네이버) + 웹 폴백 · │
│               Kakao REST(교차검증) · ONNX 모델(번들 자산) ·  │
│               Apple Vision(네이티브 모듈) · 로컬 알림(OS)    │
└────────────────────────────────────────────────────────────┘
```

**깔끔한 계층 분리** 덕분에 대부분의 기능은 `순수 서비스/도메인 코어(테스트) → 얇은 UI`
패턴으로 추가된다. 예: OCR 잠정 경로, 손익 버킷, 필터 등은 UI를 거의 안 건드리고
서비스 계층에서 끝난다.

## 2. 모듈 맵 (`app/`)

| 디렉터리 | 역할 | 대표 파일 |
|---|---|---|
| `index.tsx` | 화면 + 루트 컴포넌트 (모놀리식, 분리 예정) | — |
| `theme/` | LUCENT 디자인 토큰 + 유리 프리미티브 | `tokens.ts` · `GlassSurface.tsx` · `color.ts` |
| `services/` | 순수 비즈니스 로직 | `deliveryFilter` · `deliveryStats` · `profit` · `fuel` · `mileage` · `efficiency` · `backup`(복원 포함) · `export` · `phone` · `contactLog` · `completionPhoto` · `deadline` · `money` · `maps` · `navigation` · `notificationPlan` · `notifications` · `ocr` · `recognizer` |
| `domain/` | 도메인 모델 + 어댑터 | `models.ts`(DeliveryOrder·FuelLog·MileageLog·ContactLog) · `manualOrder.ts` · `calendar.ts` · `legacy.ts` |
| `repositories/` | 영속 계약 + 구현 (배달·주유·주행·연락) | `contracts.ts` · `local.ts` · `native.ts` |
| `ocr/` | PP-OCRv5 런타임 · 정규화 · 필드 레지스트리 + 검증/heuristic/방향/벤치마크 | `ppocr/*` · `normalize.ts` · `layout.ts` · `fieldHeuristics.ts` · `fieldValidation.ts` · `orientation.ts` |
| `platform/` | 인식기 계약 (Apple Vision / CLOVA / PP-OCR) + Vision 매핑(순수) | `receiptRecognizers.ts` · `receiptRecognition.ts` · `appleVision.ts` |
| `../modules/apple-vision-ocr/` | 네이티브 Apple Vision Expo 모듈 (Swift, `app/` 밖·routelo 루트) | `ios/AppleVisionOcrModule.swift` |
| `vendor/` | 발주처 교차검증 (카카오, PII 안전) | `verify.ts` · `resolve.ts` · `apply.ts` · `kakao.ts` |
| `settings/` | 설정 v2 스키마·기본값·마이그레이션·저장소 | `schema.ts` · `repository.ts` |
| `account/` | 계정 모델·저장소 | — |

## 3. 주요 데이터 흐름

- **부팅** — `RouteloApp`이 마운트 시 각 repository에서 상태 로드:
  `deliveryRepository.initialize() → list()`, `settingsRepository.get()`,
  `accountRepository.get()`, `fuelLogRepository.list()`, `mileageLogRepository.list()`.
- **스캔** — 카메라/갤러리 → `runReceiptOcr` (Apple Vision 우선 · PP-OCR 폴백) → 필드 검수(zero-fabrication)
  → 발주처 교차검증(옵트인) → `DeliveryOrder` 저장.
- **동선** — 주문 → `optimizeByNearestNeighbor` → 사용자 재정렬 → 다음 목적지 `openNavigation` 딥링크.
- **손익** — `summarizeDailyProfit` → `bucketProfit`(일/주/월) → 차트 · `summarizeEfficiency`(주유+주행).
- **완료** — 상세 시트 완료 토글 → `schedule.completedAt` → `deliveryRepository.save`;
  완료 사진은 문서 디렉터리에 상대경로로 저장(`completionPhoto`)하고 주문에 부착.
- **연락** — 전화 버튼 탭(다이얼 열림 성공 시) → `buildContactLog` → `contactLogRepository.save`,
  상세 시트 "최근 연락"에 표시.
- **백업/복원** — `buildBackup`이 배달·주유·주행·연락·설정을 스냅샷 → 공유; 붙여넣기 복원은
  `parseBackup`(검증) → `applyBackup`(전체 덮어쓰기).
- **알림** — 주문/설정 변경 시 `planDeliveryNotifications(orders, {nowMs, leadMinutes})`(순수)로
  엄수 마감·예식 알림 계획 산출 → 설정 토글로 필터 → `syncScheduledNotifications`(OS 예약 재조정).

## 4. 테마 시스템

- `useTheme()` → `{ C(팔레트), styles, dark }`. `C = darkMode ? DARK : LIGHT`.
- 색상은 `Palette` 키(index.tsx `LIGHT`/`DARK`), 그 외 디자인 토큰은 `app/theme/tokens.ts`.
- 조작 레이어만 `GlassSurface(strength, radius, dark, colors)`; 콘텐츠는 솔리드.
- 접근성 훅 `useReduceTransparency()` / `useReduceMotion()` 로 유리·모션 자동 대체.
- 자세한 내용: **[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)**.

## 5. OCR 인식기 경계

`ReceiptRecognizer` 계약(포트-어댑터) — Apple Vision / CLOVA / PP-OCRv5 어댑터가 같은
계약을 구현하고, **어떤 엔진도 공유 파서(`normalizeReceipt`/`parseReceiptText`)를 우회하지
않는다**. iOS 실행 순서: **Apple Vision(네이티브 모듈, 실측 우월)** → CLOVA(동의 게이트, 실호출 대기)
→ **PP-OCR(폴백)** → 수동 입력. 잠정 폴백은 토글 `IOS_INTERIM_PPOCR_FALLBACK` 로 관리.

- **Apple Vision** — `modules/apple-vision-ocr`(Swift `VNRecognizeTextRequest`, `.accurate`, 한국어 도메인
  어휘, EXIF 방향 보정)이 원시 박스를 반환하고, 순수 `platform/appleVision.ts` 가 Vision 정규화 좌표를
  픽셀로 변환·매핑한다(테스트 가능). 실측: 필수필드 9/24 → 19/24, 수령인 0/7 → 6/7 (PP-OCR 대비).
- 앱 내 end-to-end(모듈 자동링크·인식) 검증은 다음 시뮬 빌드 대상.
- 자세히: **[IOS_OCR_PIPELINE.md](IOS_OCR_PIPELINE.md)** · **[APPLE_VISION_OCR_PLAN.md](APPLE_VISION_OCR_PLAN.md)** · **[OCR_RECEIPT_TEST_2026-07-04.md](OCR_RECEIPT_TEST_2026-07-04.md)**.

## 6. 테스트 · 빌드

- **테스트** — 42개 파일 / 263 테스트, 순수 서비스·도메인 코어 중심(jest-expo).
  `npm run test:ci` · `npm run typecheck` · `npm run validate`.
- **CI** — GitHub Actions `Validate Routelo iOS` (PR·main).
- **빌드** — EAS. `ios-sim`(무료·Apple 계정 불필요, 컴파일 검증) / `device-test`(유료 멤버십).
  네이티브 의존성(예: expo-blur) 추가 PR은 CI뿐 아니라 **시뮬 빌드 통과 후 병합**.

## 7. 알려진 기술부채

- **`app/index.tsx` 모놀리식(~5,200줄)** — 화면·컴포넌트·스타일이 한 파일.
  screens/components/hooks/stores 로 분리하는 것이 우선 리팩터 대상.
- **Apple Vision** 은 네이티브 모듈로 구현·실측 완료지만, 앱 내 end-to-end 자동링크 검증 대기.
  **CLOVA** 는 결정 로직만(실호출은 유료 키 후).
- 백업 **복원(import)** 미구현 (내보내기만).
- `notifications.ts`(OS 예약 wrapper)는 네이티브 표면이라 단위테스트 없음 — 계획은 순수 `notificationPlan` 로 검증.
