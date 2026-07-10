# Routelo for iOS

한국 배달 기사(화훼·경조 중심)를 위한 **iOS 배달 업무 관리 앱**. 인수증 OCR,
동선 최적화, 엄수 마감 관리, 손익·차량 회계를 하나로 묶고, 모든 데이터를
기기에 **로컬 우선**으로 저장한다. **bare React Native** 기반(Expo 미사용)이며,
iOS Liquid Glass 철학을 재해석한 자체 디자인 시스템 **LUCENT**를 사용한다.
실기기 테스트는 Metro 없이 단독 실행되는 **배포용 Release 빌드**로만 한다.

> 이 저장소는 `JasonLee0416/Routelo.version_2`(Android 우선 v2)에서 iOS로 분기했다.
> iOS OCR 우선순위는 `Apple Vision → 동의 기반 CLOVA → PP-OCRv5(폴백) → 수동`.
> **Apple Vision 네이티브 모듈은 구현·실측 완료**(앱 내 end-to-end 검증 대기)이며, 그 전까지
> `IOS_INTERIM_PPOCR_FALLBACK`로 온디바이스 **PP-OCRv5**가 잠정 실행된다.

---

## ✨ 주요 기능

### 배달
- **CRUD** — 인수증 OCR 등록 · 직접 추가 · 수정 · 삭제
- **검색·필터·정렬** — 텍스트 검색(상품/주소/업체/전화/날짜) · 상태 필터 · 마감순/최신순
- **한눈에 파악** — 완료율 진행바 · 남은 예상 수입 · 엄수 마감 임박/지남 배지
- **연락** — 수령인·발주처·화원 전화 버튼(한국 번호 포맷) + **통화 이력 기록**(상세 시트 "최근 연락")
- **알림** — 엄수 마감·예식 시간 **로컬 푸시 알림**(설정한 lead 분 전, `expo-notifications`)
- **완료 증빙** — 배달 완료 **사진 첨부**(촬영/앨범, 상세 시트 썸네일·삭제)

### OCR (인수증)
- **Apple Vision**(iOS 전용 네이티브 Expo 모듈, `VNRecognizeTextRequest`) — 온디바이스·무료·동의 불필요. 실측에서 PP-OCR 대비 필수필드 **9/24 → 19/24**, 수령인 **0/7 → 6/7** 로 우월(주력 인식기)
- **PP-OCRv5**(ONNX Runtime) — Android 주력 + iOS 폴백. 방향 자동 보정·값 검증·필드 heuristic·벤치마크 하네스
- **CLOVA** — 저신뢰 재시도용 동의형 클라우드 폴백(결정 로직 준비, 실호출은 키 발급 후)
- **발주처 온라인 교차검증** — 후보 선택 UI, **업체명만 전송(PII 차단)**, 키 없으면 자동 비활성
- 무손실 보존 + **zero-fabrication** 검수. 상세는 아래 [문서](#-문서) 참고

### 동선
- **Nearest Neighbor** 추천 순서 + 사용자 재정렬
- 티맵·카카오맵·네이버지도 **딥링크** + 웹 지도 폴백

### 손익 · 차량
- 일/주/월 **손익 차트**(상승 애니메이션) + **CSV 내보내기**
- **주유 CRUD** · **계기판(주행거리) CRUD** · **연비 요약**(km/L · 원/km)
- **차량별 분리** — 기록에 차량 라벨, 연비 요약 **차량별 분해**

### 데이터
- **로컬 우선**(AsyncStorage), 샘플 데이터 없음 — 실사용 시작 시 빈 상태
- **전체 데이터 백업·복원**(JSON) — 배달·주유·주행·연락·설정을 내보내기/붙여넣기 복원(덮어쓰기 확인)

### 디자인 · 모션
- **LUCENT** 기능적 유리 디자인 — 유리는 조작 레이어(하단 내비·FAB·시트·검색)에만, 콘텐츠는 솔리드
- 라이트/다크 + **투명도 감소 / 모션 감소** 접근성 자동 대체
- 손익 바 상승 · 네비 탭 물결 파동 (RN `Animated`, 네이티브 드라이버)

---

## 🧱 기술 스택

bare React Native 0.85 · React 19 · TypeScript 6 ·
onnxruntime-react-native · Apple Vision(네이티브 Swift 브리지 모듈) ·
@notifee/react-native · react-native-image-picker · react-native-fs ·
@react-native-community/blur · react-native-vector-icons ·
AsyncStorage · Jest(@react-native/jest-preset). CI: GitHub Actions ·
빌드: 로컬 Xcode(`xcodebuild`, Release).

## 📁 프로젝트 구조

```
Routelo-for-IOS/
├─ README.md                 ← 이 문서
├─ routelo/                  ← 앱 소스 (bare React Native 프로젝트)
│  ├─ app/
│  │  ├─ index.tsx           화면·루트 컴포넌트 (모놀리식, 분리 예정)
│  │  ├─ theme/              LUCENT 디자인 토큰 + GlassSurface + 접근성 훅
│  │  ├─ services/           순수 비즈니스 로직 (검색·정렬·손익·주유·연비·백업/복원·전화·연락·완료사진·마감·알림…)
│  │  ├─ domain/             도메인 모델 + 어댑터 (DeliveryOrder·수동주문·달력·legacy)
│  │  ├─ repositories/       영속 계약 + AsyncStorage 구현(배달·주유·주행·연락)
│  │  ├─ ocr/ + platform/    PP-OCRv5 런타임 + Apple Vision 매핑 + 인식기 계약(Vision/CLOVA/PP-OCR)
│  │  │                      + 네이티브 호환 래퍼(fs·imagePicker·imageOps·icons)
│  │  ├─ vendor/             발주처 교차검증(카카오, PII 안전)
│  │  ├─ settings/ account/  설정 v2 스키마 + 계정
│  │  └─ __tests__ (모듈별)  46개 테스트 파일 · 313 테스트
│  ├─ ios/                   네이티브 Xcode 프로젝트 (git 추적)
│  │  └─ Routelo/            AppDelegate + AppleVisionOcr.swift + RouteloImageOps.swift
│  ├─ scripts/               빌드·검증 스크립트 (build-ios-device.sh 등)
│  └─ docs/                  설계 문서 (아래 · OCR/디자인/빌드 런북)
└─ docs/                     상위 히스토리 (CHANGELOG · HANDOFF · EVOLUTION · ADR)
```

자세한 계층·데이터 흐름은 **[아키텍처 문서](routelo/docs/ARCHITECTURE.md)** 참고.

## 🎨 디자인 시스템 (LUCENT)

토큰 소스는 `routelo/app/theme/`(`tokens.ts`, `GlassSurface.tsx`, `color.ts`).
전체 스펙(컬러/Radius/Glass/모션/접근성 + 플랫폼 예시)은
**[디자인 시스템 문서](routelo/docs/DESIGN_SYSTEM.md)** 참고. 요약:

- **컬러** — iOS 시스템 컬러(Primary `#0A84FF`, 긴급 `#FF453A`, 임박 `#FF9F0A`, 완료 `#34C759`), 라이트/다크
- **Radius** — continuous-corner 시맨틱 토큰(버튼 16 · 카드 24 · 시트 32 · 내비 36 · pill 999) + concentric 규칙
- **Glass strength** — `none / subtle / regular / prominent / clear` 강도 토큰, 조작 레이어별 매핑
- **접근성** — `useReduceTransparency` / `useReduceMotion` 로 유리·모션 자동 솔리드/정지

## 🚀 시작하기

```bash
cd routelo
npm install
cd ios && pod install && cd ..
```

검증(로컬 그린 게이트):

```bash
npm run validate     # verify:no-mlkit + verify:ocr-models + test:ci + typecheck
```

**iOS 빌드는 로컬 Xcode로 한다** (Mac 필요, Metro 불필요):

```bash
npm run build:ios:device      # Release 빌드 → 연결된 iPhone에 설치·실행
                              # 서명 설정은 docs/IOS_DEVICE_TEST.md 참고
```

## ✅ 테스트 · CI

- `npm run test:ci` — 46개 테스트 파일 / 313 테스트 (순수 서비스·도메인 코어 중심)
- GitHub Actions `Validate Routelo iOS` — 모든 PR·main push마다 `test:ci · typecheck · verify:no-mlkit · verify:ocr-models`

## 🗺️ 상태 · 로드맵

백로그는 GitHub **이슈**로 추적한다([#47–#53](https://github.com/JasonLee0416/Routelo-for-IOS/issues)).

**완료** — 위 기능 전체, **Apple Vision 네이티브 OCR**(구현 + 실측), **로컬 알림**,
**백업 복원(import)**, **완료 사진 첨부**, **연락 기록**, **차량별 연비**,
iOS 릴리스 설정(암호화 선언·privacy manifest), LUCENT 디자인 이식, EAS 시뮬 빌드 파이프라인.

**다음 (무지출)** —
- `index.tsx` 분리 리팩터 ([#48](https://github.com/JasonLee0416/Routelo-for-IOS/issues/48))
- Apple Vision 앱 내 end-to-end 검증(맥 필요, [#47](https://github.com/JasonLee0416/Routelo-for-IOS/issues/47))
- OCR **표 컬럼 재구성** ([#49](https://github.com/JasonLee0416/Routelo-for-IOS/issues/49))

**유료/자산 대기** —
- App Store 아이콘·제출 ([#52](https://github.com/JasonLee0416/Routelo-for-IOS/issues/52), Apple Developer 멤버십)
- CLOVA/Kakao 실호출·지오코딩 ([#53](https://github.com/JasonLee0416/Routelo-for-IOS/issues/53), 유료 키)

## 📚 문서

- **[아키텍처](routelo/docs/ARCHITECTURE.md)** · **[디자인 시스템(LUCENT)](routelo/docs/DESIGN_SYSTEM.md)**
- OCR — [파이프라인](routelo/docs/OCR_PIPELINE.md) · [Apple Vision 계획](routelo/docs/APPLE_VISION_OCR_PLAN.md) · [파이프라인 로그](routelo/docs/OCR_PIPELINE_LOG.md) · [실측 보고서(2026-07-04)](routelo/docs/OCR_RECEIPT_TEST_2026-07-04.md) · [iOS 인식기 경계](routelo/docs/IOS_OCR_PIPELINE.md)
- 빌드/실행 — [맥 시뮬 뷰어 런북](routelo/docs/IOS_SIM_PREVIEW.md) · [실기기 테스트](routelo/docs/IOS_DEVICE_TEST.md)

## 🔒 불변 원칙 (OCR)

어떤 iOS OCR 변경도 다음을 지킨다: ① OCR 값 조작 금지(zero-fabrication) ·
② 원문/provenance 검수 · ③ 로컬 우선 저장 · ④ 클라우드 폴백은 명시적 동의 ·
⑤ 인식 후 **단일 공유 정규화**(`normalizeReceipt` / `parseReceiptText`).

## License

[MIT](routelo/LICENSE)
