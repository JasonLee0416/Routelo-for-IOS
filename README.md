# Routelo for iOS

한국 배달 기사(화훼·경조 중심)를 위한 **iOS 배달 업무 관리 앱**. 인수증 OCR,
동선 최적화, 엄수 마감 관리, 손익·차량 회계를 하나로 묶고, 모든 데이터를
기기에 **로컬 우선**으로 저장한다. React Native(Expo) 기반이며, iOS Liquid Glass
철학을 재해석한 자체 디자인 시스템 **LUCENT**를 사용한다.

> 이 저장소는 `JasonLee0416/Routelo.version_2`(Android 우선 v2)에서 iOS로 분기했다.
> iOS OCR은 `Apple Vision → 동의 기반 CLOVA → 공유 정규화` 를 지향하며, 두 네이티브
> 경로가 준비되기 전까지는 **온디바이스 PP-OCRv5**가 잠정 경로로 동작한다.

---

## ✨ 주요 기능

### 배달
- **CRUD** — 인수증 OCR 등록 · 직접 추가 · 수정 · 삭제
- **검색·필터·정렬** — 텍스트 검색(상품/주소/업체/전화/날짜) · 상태 필터 · 마감순/최신순
- **한눈에 파악** — 완료율 진행바 · 남은 예상 수입 · 엄수 마감 임박/지남 배지
- **연락** — 수령인·발주처·화원 전화 버튼(한국 번호 포맷)

### OCR (인수증)
- 온디바이스 **PP-OCRv5**(ONNX Runtime) 잠정 경로 + 촬영 품질 검사(선명도·밝기·기울기…)
- **발주처 온라인 교차검증(#48)** — 후보 선택 UI, **업체명만 전송(PII 차단)**, 키 없으면 자동 비활성
- 무손실 보존(원문·정규화·미매핑) + **zero-fabrication** 검수 원칙

### 동선
- **Nearest Neighbor** 추천 순서 + 사용자 재정렬
- 티맵·카카오맵·네이버지도 **딥링크** + 웹 지도 폴백

### 손익 · 차량
- 일/주/월 **손익 차트**(상승 애니메이션) + **CSV 내보내기**
- **주유 CRUD** · **계기판(주행거리) CRUD** · **연비 요약**(km/L · 원/km)

### 데이터
- **로컬 우선**(AsyncStorage), 샘플 데이터 없음 — 실사용 시작 시 빈 상태
- **전체 데이터 백업**(JSON, 공유 시트)

### 디자인 · 모션
- **LUCENT** 기능적 유리 디자인 — 유리는 조작 레이어(하단 내비·FAB·시트·검색)에만, 콘텐츠는 솔리드
- 라이트/다크 + **투명도 감소 / 모션 감소** 접근성 자동 대체
- 손익 바 상승 · 네비 탭 물결 파동 (RN `Animated`, 네이티브 드라이버)

---

## 🧱 기술 스택

Expo SDK 56 · React Native 0.85 · React 19 · TypeScript 6 ·
onnxruntime-react-native · expo-blur · AsyncStorage · Jest(jest-expo).
CI: GitHub Actions · 빌드: EAS(클라우드).

## 📁 프로젝트 구조

```
Routelo-for-IOS/
├─ README.md                 ← 이 문서
├─ routelo/                  ← 앱 소스 (Expo 프로젝트)
│  ├─ app/
│  │  ├─ index.tsx           화면·루트 컴포넌트 (모놀리식, 분리 예정)
│  │  ├─ theme/              LUCENT 디자인 토큰 + GlassSurface
│  │  ├─ services/           순수 비즈니스 로직 (검색·정렬·손익·주유·연비·백업·전화·마감…)
│  │  ├─ domain/             도메인 모델 + 어댑터 (DeliveryOrder·수동주문·달력·legacy)
│  │  ├─ repositories/       영속 계약 + AsyncStorage 구현
│  │  ├─ ocr/ + platform/    PP-OCRv5 런타임 + 인식기 계약(Apple Vision/CLOVA/PP-OCR)
│  │  ├─ vendor/             발주처 교차검증(카카오, PII 안전)
│  │  ├─ settings/ account/  설정 v2 스키마 + 계정
│  │  └─ __tests__ (모듈별)  32개 테스트 파일 · 165 테스트
│  ├─ docs/                  설계 문서 (아래)
│  └─ eas.json               빌드 프로파일: device-test / ios-sim / preview / production
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
npm start            # Expo dev server (Expo Go 불가 — PP-OCR 네이티브 필요, dev client 사용)
```

검증(로컬 그린 게이트):

```bash
npm run validate     # verify:no-mlkit + verify:ocr-models + test:ci + typecheck + doctor + build:web
```

**iOS 빌드는 EAS 클라우드에서 한다** (Windows에서도 가능):

```bash
# 무료 · Apple 계정 불필요 — 시뮬레이터 빌드로 컴파일 검증
eas build --platform ios --profile ios-sim

# 실기기 (유료 Apple Developer 멤버십 필요)
npm run build:ios:device      # docs/IOS_DEVICE_TEST.md 참고
```

## ✅ 테스트 · CI

- `npm run test:ci` — 32개 테스트 파일 / 165 테스트 (순수 서비스·도메인 코어 중심)
- GitHub Actions `Validate Routelo iOS` — 모든 PR·main push마다 `test:ci · typecheck · verify:no-mlkit · verify:ocr-models`

## 🗺️ 상태 · 로드맵

**완료** — 위 기능 전체, LUCENT 디자인 이식(팔레트·토큰·GlassSurface·모션), EAS 시뮬 빌드 파이프라인.

**유료/네이티브 대기** —
- **Apple Vision 브릿지** (네이티브 Vision 모듈)
- **CLOVA / Kakao 실호출** (유료 키 발급 후)
- **실기기·TestFlight·App Store** (유료 Apple Developer 멤버십)

## 🔒 불변 원칙 (OCR)

어떤 iOS OCR 변경도 다음을 지킨다: ① OCR 값 조작 금지(zero-fabrication) ·
② 원문/provenance 검수 · ③ 로컬 우선 저장 · ④ 클라우드 폴백은 명시적 동의 ·
⑤ 인식 후 **단일 공유 정규화**(`normalizeReceipt` / `parseReceiptText`).

## License

[MIT](routelo/LICENSE)
