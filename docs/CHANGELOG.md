# RouteLO 변경 이력 (CHANGELOG)

`main` 기준 주요 변경을 시점별로 정리한다. 상세는 각 PR/이슈 참조.

## 2026-07 — bare React Native 전환

### 추가/변경
- **Expo 완전 제거 → bare React Native 0.85**: 실기기 테스트를 Metro 없는
  **배포용 Release 빌드**로 일원화. `npm run build:ios:device`(로컬 Xcode)로
  빌드→설치→실행. `ios/` 네이티브 프로젝트를 git 추적으로 전환.
- **네이티브 모듈 재작성**: Apple Vision OCR을 Expo 모듈에서 RCT 브리지
  Swift 모듈(`ios/Routelo/AppleVisionOcr.swift`)로 포팅. OCR 전처리
  crop/resize는 자체 `RouteloImageOps.swift`로 대체(expo-image-manipulator 제거).
- **라이브러리 교체**: expo-notifications→notifee, expo-image-picker→
  react-native-image-picker(+react-native-permissions), expo-file-system→
  react-native-fs(호환 래퍼 `app/platform/fs.ts`), expo-blur→
  @react-native-community/blur, @expo/vector-icons→react-native-vector-icons.
- **OCR 모델 적재 방식 변경**: expo-asset(metro require) → Xcode 번들
  리소스 폴더(`assets/ocr` → 앱 번들 `/ocr`) + `RNFS.MainBundlePath`.
- **도구 체인**: jest-expo→@react-native/jest-preset, expo/metro-config→
  @react-native/metro-config, expo/tsconfig.base→@react-native/typescript-config.

### 제거/정리
- EAS 빌드 파이프라인(eas.json)·dev-client·web 타깃(react-native-web)·
  expo-modules-jsi 패치 제거. `validate`에서 expo-doctor·build:web 제외.

### 알려진 동작 차이
- 완료 사진 첨부의 시스템 크롭 UI(allowsEditing) 미지원 — 원본 사진 그대로 저장.
- 사진 보관함은 PHPicker 기반으로 권한 프롬프트 없이 동작.

## 2026-06 — 실사용 준비 라운드

### 추가/변경
- **전면 다크테마** (#45): 16토큰 LIGHT/DARK 팔레트 + 테마 컨텍스트(`useTheme`)로 모든 화면·카드·입력·시트·모달 테마화. 강조 카드(진행률/알림요약/프로필/OCR요약)는 `emphasis` 토큰으로 양 테마에서 진한 배경 유지.
- **동선(경로) 화면 개편** (#47): 장식용 가짜 지도와 Google Maps 핸드오프 제거. 사용자가 **배달 순서를 직접 스택으로 정렬**(▲/▼)하고, 맨 위 목적지로 **선택한 내비 앱**(티맵·카카오맵·네이버 지도)을 통해 바로 경로 안내. 설정에서 내비 앱 선택.
- **설정 v2** (#41, #42): 버전드 스키마 + 결정적 마이그레이션(v1→v2) + 그룹형 UI + 검색형 구역 수수료 편집. 알림/경로/개인정보 토글이 영속 설정에 연결됨.
- **OCR 레이아웃 인식** (#43): PP-OCR 바운딩박스 기반 행/열 재구성으로 라벨↔값 연결 정확도 향상.
- **캘린더 위험 신호** (#44): 일정 충돌·도착 지연 위험을 결정적으로 평가해 월 셀·아젠다 카드에 표시.
- **OCR 엔진** (#38): ML Kit 제거, Android/iOS 공용 **PP-OCRv5 온디바이스(ONNX) 런타임**으로 일원화.

### 제거/정리
- **OCR 주문번호 필드 제거** (#46): 주문번호 추출/표시 기능 제거(레지스트리·전용 추출 로직·라벨·타입·아이콘). 도메인 optional 필드는 유지.
- **샘플/데모 데이터 전면 제거** (#50): 시드 샘플 배달·주유 로그·데모 OCR 영수증 제거. 앱은 빈 상태로 시작하고 실제 스캔/입력 데이터만 보유. `app/data.ts` 삭제, `DEMO_RECEIPT_TEXT`는 테스트 전용 픽스처로 이동.

### 진행 중 / 토대
- **발주처 온라인 교차검증 코어** (#49, 이슈 #48): provider-agnostic `VendorDirectory` 계약 + 카카오 로컬 프로바이더 + 오프라인 폴백 + 매칭 로직(이름 퍼지 + 전화 일치) + 모킹 테스트. **옵트인(기본 OFF)**, **업체명만 전송(개인정보 차단)**, **자동 덮어쓰기 없음**, 키 없으면 자동 비활성. 후속: 파이프라인 연결 + 설정 토글(PR2), 후보 선택 UI(PR3).

### 검증/품질
- 이슈 #12(Android 하단 내비 ↔ 시스템 내비 겹침) — 실물 Galaxy S26 Ultra에서 3버튼·제스처·키보드 검증 후 **종료**.
- 전 항목 `tsc --noEmit` + Jest 통과, CI(Android APK·iOS Simulator·test/typecheck) 그린.
