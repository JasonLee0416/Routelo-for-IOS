# App Store 런칭 체크리스트 (Routelo)

무료 개인 팀으로 실기기 테스트하던 단계에서 **App Store 정식 출시 + 이후 업데이트**로
넘어가기 위한 준비. 상태 표기: ✅ 됨 · ⚠️ 사용자 조치 필요 · ⬜ 남음.

관련: 이슈 #52(iOS 릴리스 준비) · 메타데이터 초안은 `APP_STORE_METADATA.md`.

---

## 0. 한눈에 보는 흐름
```
[최초 1회] 유료 가입 → 앱 등록 → 서명/업로드 준비 → 메타데이터/스크린샷 → 심사 제출 → 출시
[이후 업데이트] 코드 수정 → npm run release:beta (TestFlight) / release:appstore (정식)
```

## 1. 계정·프로그램 (⚠️ 결제 필요 — 직접)
- ⚠️ **Apple Developer Program 가입** ($99/년): https://developer.apple.com/programs/
- ⚠️ App Store Connect 접속 확인: https://appstoreconnect.apple.com
- ⚠️ 유료 계약(Paid/Free Apps Agreement) 동의 — 미동의 시 앱이 심사에 안 올라감

## 2. 코드/프로젝트 상태 (대부분 완료)
- ✅ bare RN 0.85, `Routelo.xcworkspace` / `Routelo` scheme, Release 빌드 성공(실기기 검증)
- ✅ `ITSAppUsesNonExemptEncryption = false` (수출 규정 자동 처리)
- ✅ `PrivacyInfo.xcprivacy` — 사용 API 사유(FileTimestamp/UserDefaults/SystemBootTime), 추적 없음
- ✅ 권한 사용 설명(카메라/사진) Info.plist에 존재
- ✅ 버전 1.0.0 / 빌드 1 (이후 `fastlane bump`가 자동 증가)
- ⚠️ **번들 ID 확정**: 현재 `com.jasonlee0312.routelo.ios`. 이대로 등록하거나 변경 시
  `PRODUCT_BUNDLE_IDENTIFIER` 환경변수로 통일.

## 3. 앱 아이콘 (⚠️ 디자인 자산)
- ✅ `AppIcon.appiconset`에 1024×1024 단일 아이콘 등록됨(현재는 임시 아이콘)
- ⚠️ **정식 브랜드 아이콘(1024×1024, 투명/알파 없음, 라운드코너 없음)** 으로 교체 권장
  - 파일 교체 위치: `ios/Routelo/Images.xcassets/AppIcon.appiconset/icon.png`
  - 단일 1024 아이콘이면 Xcode가 나머지 크기를 자동 생성

## 4. 스크린샷 (⚠️ 캡처 필요)
App Store는 아래 크기가 **최소 1세트** 필요. 요즘은 6.7"만 있어도 6.5"에 자동 적용됨.
- **6.7" (iPhone 15/16 Pro Max, 1290×2796)** — 필수, 2~10장
- (선택) 6.5"(1284×2778), 5.5"(1242×2208)
- iPad 미지원(`supportsTablet` 아님)이면 iPad 스크린샷 불필요

추천 캡처 화면(스토리 순서):
1. 인수증 스캔 → 자동 입력 검수 화면
2. 오늘의 배달 목록(마감/우선순위)
3. 배달 동선(순서 변경·길안내)
4. 마감/예식 알림
5. 캘린더 수익 + 인수증 사진

캡처 방법: 시뮬레이터(정확한 픽셀) 또는 실기기 후 리사이즈. 상태바 정리는
`xcrun simctl status_bar` 활용 가능.

## 5. 서명·업로드 준비 (fastlane)
- ✅ `ios/Gemfile`, `ios/fastlane/Fastfile`·`Appfile`, `ios/fastlane/.env.example` 추가됨
- ⚠️ **App Store Connect API 키 발급**(권장): App Store Connect → Users and Access →
  Integrations → App Store Connect API → 키 생성 → `AuthKey_XXXX.p8` 다운로드
- ⚠️ `ios/fastlane/.env` 생성(`.env.example` 복사) 후 `ASC_KEY_ID`·`ASC_ISSUER_ID`·
  `ASC_KEY_PATH`·`DEVELOPMENT_TEAM` 채우기 (이 파일은 git 미추적)
- ⚠️ 설치: `cd ios && bundle install` (fastlane/cocoapods)
- 서명은 자동(`-allowProvisioningUpdates` + 자동 서명). 완전 무인 CI로 가면 이후
  `match` 도입을 검토(배포 인증서를 별도 저장소로 관리).

## 6. App Store Connect에 앱 생성 (⚠️ 최초 1회)
- ⚠️ My Apps → + → New App: 플랫폼 iOS, 이름 **Routelo**, 기본 언어 한국어, 번들 ID 선택,
  SKU(임의 문자열) 입력
- ⚠️ 메타데이터 입력: `APP_STORE_METADATA.md`의 부제/설명/키워드/프로모션/URL
- ⚠️ App Privacy 설문: `APP_STORE_METADATA.md`의 "개인정보 답변 초안" 참고 (추적 없음)
- ⚠️ **개인정보 처리방침 URL** 준비(필수)

## 7. 첫 제출
```bash
cd routelo
npm run release:appstore     # = cd ios && bundle exec fastlane release
```
- 빌드 번호 자동 +1 → Release 아카이브 → 업로드 → 심사 제출(승인 시 자동 출시)
- 첫 업로드는 메타데이터/스크린샷을 App Store Connect UI에서 채운 뒤 제출하는 것을 권장
  (Fastfile은 `skip_metadata/skip_screenshots: true`로 바이너리 위주 업로드)
- 심사는 보통 수 시간~1일. 리젝 시 사유가 Resolution Center에 옴.

## 8. TestFlight로 먼저 검증 (권장)
정식 심사 전에 실사용자에게 빠르게 배포해 확인:
```bash
npm run release:beta         # TestFlight 업로드(내부 테스터 즉시)
```
- 내부 테스터(최대 100명, App Store Connect 계정)에는 심사 없이 즉시 배포
- 외부 테스터는 최초 1회 가벼운 베타 심사

## 9. 이후 업데이트 (반복)
```
코드 수정 → 검증(npm run validate) → npm run release:beta 로 확인 → npm run release:appstore
```
- 사용자 노출 버전 바꿀 땐 `MARKETING_VERSION`(예: 1.0.1)만 올리면 됨. 빌드 번호는 자동.
- 릴리스 노트(What's New)는 App Store Connect에서 매 업데이트마다 입력.

## 10. 심사 통과를 위한 점검
- ⚠️ 앱이 크래시 없이 **로그인/게스트 양쪽에서** 핵심 플로우 동작(스캔·등록·동선·알림)
- ⚠️ 데모용 가짜 데이터/디버그 화면 노출 없는지
- ⚠️ 권한 요청 문구가 실제 사용 목적과 일치(카메라/사진/알림)
- ⚠️ 외부 지도앱 연동 시 미설치 상황에서도 크래시 없이 폴백(이미 처리됨)
- ⚠️ 로그인 기능이 "필수"가 아니면 게스트 사용 경로 유지(Guideline 5.1.1 관련)

---

## 남은 액션 요약 (사용자)
1. Apple Developer Program 가입/결제
2. App Store Connect 앱 생성 + 개인정보 처리방침 URL
3. 정식 앱 아이콘 + 스크린샷 준비
4. App Store Connect API 키 발급 → `ios/fastlane/.env` 작성
5. `cd ios && bundle install` 후 `npm run release:beta`로 첫 업로드 테스트

코드/설정/문서 쪽은 준비되어 있으니, 위 계정·자산만 갖춰지면 명령어 한 줄 흐름으로 진입한다.
