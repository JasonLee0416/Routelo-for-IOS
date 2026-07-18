# 런치 후 수정안 (2026-07)

실기기(iPhone 15 Pro Max) 설치·실사용 후 발견된 UX/기능 결함 3건의 원인 분석과
수정 계획. bare React Native 0.85 기준(#68 병합 이후).

---

## 1. 네비게이션 연동이 항상 네이버지도로 열림

### 증상
설정에서 티맵/카카오맵/네이버지도 중 무엇을 골라도 **네이버지도 앱**으로만 연결됨.

### 원인
`app/services/navigation.ts`

1. **좌표가 없으면 web fallback으로 직행.** 배송지는 영수증 OCR 텍스트 주소라
   좌표가 지오코딩되지 않아(`latitude/longitude`가 0/미정) `openNavigation`의
   `hasCoords`가 false → 곧바로 `navWebFallback` 실행.
2. **tmap의 web fallback이 네이버 URL.** `navWebFallback('tmap')`이
   `https://map.naver.com/...`을 반환 → 티맵을 골라도 네이버가 열림.
3. **iOS 스킴 화이트리스트 없음.** `ios/Routelo/Info.plist`에
   `LSApplicationQueriesSchemes`가 없어 `canOpenURL`로 앱 설치 여부를 판별할 수 없음.

### 수정
- **주소 기반 딥링크 추가** (좌표 없이도 각 앱이 열리도록):
  - 좌표 있음 → 기존 route 딥링크 유지(정확한 경로 안내)
  - 좌표 없음 → 각 앱의 **검색 딥링크**로 목적지 주소 전달
    - 티맵: `tmap://search?name=<주소>`
    - 카카오맵: `kakaomap://search?q=<주소>`
    - 네이버: `nmap://search?query=<주소>&appname=<pkg>`
- **`canOpenURL`로 설치 여부 확인** 후, 설치돼 있으면 반드시 해당 앱 딥링크를
  연다. 미설치일 때만 각 앱 **자기 브랜드 web fallback**으로 (티맵 web fallback을
  네이버로 보내던 버그 제거).
- **`Info.plist`에 `LSApplicationQueriesSchemes`** 추가: `tmap`, `kakaomap`,
  `nmap`, `kakaonavi`.
- `navigation.test.ts`를 새 동작(각 앱 자기 앱으로 연결)에 맞게 갱신.

---

## 2. 회원 이름이 인사말에 반영되지 않음

### 증상
회원가입 시 이름을 입력해도 홈 상단이 항상 `"안녕하세요, 기사님"`으로 표시됨.

### 원인
`app/index.tsx:242` — HomeScreen 헤더 title이 `"안녕하세요, 기사님"` 하드코딩.
`account.profile.displayName`은 존재하나 HomeScreen에 전달되지 않음.

### 수정
- HomeScreen에 `account`(또는 displayName)를 prop으로 전달.
- 인사말을 이름 기반으로 생성:
  - 회원이며 이름이 있으면 → `"안녕하세요, ㅇㅇㅇ 기사님"`
  - 게스트/이름 없음 → 기존 `"안녕하세요, 기사님"` 유지
  - `게스트 기사`·`업무 기사` 같은 플레이스홀더 이름은 개인화에서 제외.

---

## 3. 글자 크기 확대 + 체크 항목과의 균형

### 증상
전반적으로 글자가 작아 가독성이 낮고, 텍스트와 체크박스/토글의 크기 균형이 안 맞음.

### 원인
`app/theme/appStyles.ts`에 fontSize가 8~11px로 작게 하드코딩된 스타일이 ~150개.
체크/토글 컴포넌트 크기는 그대로여서 확대된 텍스트와 부조화.

### 수정
- **일률적 글자 확대:** `makeStyles`에서 StyleSheet 생성 직전에 모든 `fontSize`를
  공통 배율(약 1.15배)로 스케일하고, 명시적 `lineHeight`도 같은 비율로 보정하는
  단일 유틸을 적용. 극소 폰트(8~9px)가 가독 가능한 범위로 올라옴.
- **체크 항목 균형:** 체크박스/토글/라디오의 크기·정렬을 확대된 텍스트에 맞춰
  재조정(설정 토글 행, OCR 검수 체크 행, 온보딩 선택 등). 라벨·캡션 라인하이트를
  손봐 세로 정렬을 맞춤.
- 스냅샷/레이아웃 회귀는 타입체크 + 전체 테스트로 확인.

---

## 검증
- `npm run typecheck`, `npm test`(313+), 실기기 스모크(각 네비 앱 연결·인사말·가독성).
