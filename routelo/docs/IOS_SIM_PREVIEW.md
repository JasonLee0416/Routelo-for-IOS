# iOS 시뮬레이터 프리뷰 (맥 = 뷰어) 런북

Windows에서 코딩하고, EAS 클라우드가 빌드하고, **맥은 완성된 `.app`을 받아 시뮬레이터에서 열기만** 하는
워크플로우 문서입니다. 맥에는 레포·Node·npm 아무것도 필요 없습니다 — Xcode의 iOS 시뮬레이터만 있으면 됩니다.

```
[Windows에서 코딩] → git push → GitHub(main) → [EAS가 .app 빌드] → [맥은 .app만 받아 실행]
```

`.app`에는 JS 번들까지 전부 내장되어 있어 Metro 개발 서버가 필요 없습니다
(빌드 프로필 `ios-sim-preview`, `eas.json` 참고 — `developmentClient` 없음 = standalone).

---

## 1. 완성 앱 보기 (순수 뷰어 · Apple 계정 불필요)

### 1-1. 빌드 만들기 (아무 OS에서나 · 클라우드)

```bash
# routelo/ 안에서, EAS 로그인(Expo owner: jasonlee0312) 후
npx --yes eas-cli@latest build --platform ios --profile ios-sim-preview
```

완료되면 다운로드 URL과 함께 시뮬레이터용 `.tar.gz` 아티팩트가 나옵니다.
링크를 잃어버렸거나 만료(≈30일)됐으면 다시 조회:

```bash
npx --yes eas-cli@latest build:list --platform ios --limit 5
```

### 1-2. 맥에서 받아서 실행

```bash
# 1) 아티팩트 다운로드 (브라우저로 받아도 됨)
curl -L -o routelo.tar.gz "<빌드 아티팩트 URL>"

# 2) 압축 해제 → *.app 폴더가 나옴
tar -xvzf routelo.tar.gz

# 3) 시뮬레이터 부팅 → 설치 → 실행
open -a Simulator
xcrun simctl install booted ./*.app
xcrun simctl launch booted com.jasonlee0312.routelo.ios
```

- 번들 ID `com.jasonlee0312.routelo.ios` 는 `app.json`의 `ios.bundleIdentifier` 값입니다.
- 홈 화면에 아이콘이 뜨면 탭해서 열어도 됩니다.
- 코드를 고쳐 새 화면을 보려면: Windows에서 수정 → push → 새 `ios-sim-preview` 빌드 → 맥에서 새 `.app` 받아 다시 설치.

### 앱 데이터에 대해

앱은 **로컬 우선(local-first)** 이라 빈 상태로 시작하는 게 정상입니다.
시뮬레이터에서 `직접 추가` 또는 영수증 스캔으로 배달 몇 건을 넣으면
손익 · 차트 · 연비 · 효율 흐름을 모두 확인할 수 있습니다.

---

## 2. (선택) 맥에서 직접 개발까지 하기

핫리로드가 필요하면 그때만 클론합니다. PR 41개 전부 원격에 있어 하나도 빠짐없이 받아집니다.

```bash
git clone https://github.com/JasonLee0416/Routelo-for-IOS.git
cd Routelo-for-IOS/routelo
npm install
npx expo start --dev-client   # ios-sim(dev client) 빌드를 설치·연결하면 핫리로드
```

dev client 시뮬레이터 빌드는 standalone이 아니라 Metro가 필요합니다:

```bash
npx --yes eas-cli@latest build --platform ios --profile ios-sim
```

---

## 트러블슈팅

### `npm install`이 `onnxruntime-node` postinstall에서 ECONNRESET로 실패

`onnxruntime-node`는 플랫폼에 따라 **추가 GPU(CUDA) 바이너리**를 NuGet에서 내려받는데,
그 다운로드가 막히면 install 전체가 롤백됩니다. CPU 바인딩은 이미 패키지에 번들되어 있어
**CUDA는 이 앱에 불필요**합니다. 다운로드를 건너뛰면 됩니다:

```bash
ONNXRUNTIME_NODE_INSTALL=skip npm install
```

설치를 이미 `--ignore-scripts`로 했다면 패치만 따로 적용:

```bash
npx --yes patch-package
```

### 검증 게이트 (빌드 전에 그린 확인)

```bash
npm run validate
```

= `verify:no-mlkit` + `verify:ocr-models` + `test:ci`(165) + `typecheck` + `doctor` + `build:web`.
`doctor`(expo-doctor)의 "Expo config schema" · "RN Directory" 검사는 **외부 API 호출**이라
egress가 막힌 환경에서는 실패로 표시될 수 있습니다 — 코드 문제가 아니며 인터넷 정상 환경에서는 통과합니다.
