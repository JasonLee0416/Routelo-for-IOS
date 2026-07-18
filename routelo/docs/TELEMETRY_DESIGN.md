# 품질 리포트(텔레메트리) 설계

목표: 지인 배포(TestFlight) 후 **실사용 OCR 교정 데이터**를 모아 인식 정확도/성능을
개선한다. 앱은 로컬 우선·개인정보 미전송이 기본이므로, 수집은 **옵트인 + 비식별**을
전제로 한다. 다루는 데이터에 **수령인 이름·주소·전화(제3자 PII)** 가 포함되므로
프라이버시 보호가 최우선.

## 무엇을 모으나 — "교정쌍"
가장 값진 신호는 OCR이 읽은 값과 사용자가 확정한 값의 차이다.
- 필드별: `key`, `changed`(수정 여부), `editDistance`(오류 크기), `confidence`, `method`
- 성능: `processingMs`, `documentConfidence`, `quality`, `engine`, `modelVersion`
- 앱: 익명 설치 ID(랜덤 UUID, 개인 식별 불가), 앱 버전, 타임스탬프

## 프라이버시 by design
- **옵트인**: 설정에서 켜야만 수집(기본 OFF). 언제든 끌 수 있음.
- **필드 분류**
  - 비-PII(상품명·수량·날짜/시간·업체명): **원문 그대로** 전송(학습 가치 높음, 위험 낮음)
  - PII(수령인 이름·전화·주소·메모·리본): **shape 마스킹** 전송
    - 숫자→`N`, 한글→`○`, 영문→`x`, 구분자·공백은 유지
    - 예: `홍길동 010-1234-5678` → `○○○ NNN-NNNN-NNNN`
    - 정체성은 사라지되 **길이·구조 변화(오류 패턴)** 는 남는다
  - 모든 필드에 `editDistance`(원문 기준 계산, 숫자 자체는 비식별) 포함 → PII도 오류 크기 측정 가능
- **이미지 미전송**(기본). 원본 영수증 업로드는 추후 별도의 더 강한 동의로만.

## 전송 구조 (네이티브 SDK 없이)
```
[동의 ON] → 이벤트를 로컬 큐(AsyncStorage)에 적재 → HTTPS로 Firestore REST 업로드 → 실패 시 재시도
```
- **Firestore REST**(`fetch`)만 사용 → 새 네이티브 의존성 0, 지금 앱에 바로 붙음.
- **전송 시점**: 앱 포그라운드 복귀 시 + 스캔 등록 직후(온라인일 때). iOS 상시 백그라운드는
  제약이 커서, 지인 테스트 규모엔 기회적(opportunistic) 전송으로 충분.
- 큐는 배치로 비우고, 서버 확인(2xx) 후 제거 → 오프라인/실패에도 유실 없음.

## 모듈
- `app/telemetry/schema.ts` — 이벤트 타입
- `app/telemetry/redact.ts` — PII 분류·shape 마스킹·editDistance(순수, 테스트)
- `app/telemetry/events.ts` — 원본/확정 필드 → 교정 이벤트(순수, 테스트)
- `app/telemetry/queue.ts` — KV 큐(순수 인터페이스, 테스트)
- `app/telemetry/firestore.ts` — REST 업로더(fetch)
- `app/telemetry/config.ts` — 프로젝트 설정(app config), 없으면 비활성
- `app/telemetry/index.ts` — 오케스트레이터(record/flush)

## 설정/법적
- 설정에 `telemetry.enabled`(기본 false) + 동의 설명 화면
- 개인정보 처리방침에 수집 항목 명시, App Store 데이터 수집 신고 갱신(현재 "미수집")
- 한국 PIPA: 제3자 정보 수집이므로 동의 문구·목적·보관기간 명확화

설정 방법(Firebase 프로젝트·규칙·키)은 `TELEMETRY_SETUP.md` 참고.
