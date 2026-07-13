# 품질 리포트(텔레메트리) 설정 — Firebase

지인 배포 후 OCR 교정 데이터를 모으기 위한 설정. 설계·수집 항목은
`TELEMETRY_DESIGN.md` 참고. 앱은 네이티브 SDK 없이 **Firestore REST**로 전송한다.

## 1. Firebase 프로젝트 만들기
1. https://console.firebase.google.com → 프로젝트 생성
2. 좌측 **빌드 → Firestore Database → 데이터베이스 만들기** (지역: asia-northeast3 서울 권장)
3. 프로젝트 설정(⚙️) → **일반** 탭에서 다음 값을 확인:
   - **프로젝트 ID** (예: `routelo-telemetry`)
   - **웹 API 키** (웹 앱 추가 시 `apiKey`) — 이 키는 비밀이 아니며 클라이언트에
     넣어도 된다. 접근은 아래 보안 규칙으로 통제한다.

## 2. 앱에 값 넣기
`routelo/app/telemetry/config.ts`의 두 값을 채운다:
```ts
export const TELEMETRY_CONFIG = {
  projectId: 'routelo-telemetry',
  apiKey: 'AIza...............',
  collection: 'ocr_reports',
};
```
비어 있으면 수집은 자동 비활성(설정 토글을 켜도 전송 안 함).

## 3. Firestore 보안 규칙 (쓰기 전용, 최소 권한)
콘솔 **Firestore → 규칙**에 아래를 넣는다. 클라이언트는 리포트를 **생성만** 할 수
있고, 읽기/수정/삭제는 막는다(당신은 콘솔/서버 키로 조회).
```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /ocr_reports/{id} {
      allow create: if
        request.resource.data.type == 'ocr_scan_review' &&
        request.resource.data.schema is int;
      allow read, update, delete: if false;
    }
  }
}
```
> 더 엄격히 하려면 Firebase **App Check**(DeviceCheck)를 붙여 봇/남용을 막을 수 있다.
> 지인 소규모 테스트에는 위 규칙으로 충분하다.

## 4. 배포 & 확인
1. `config.ts` 채운 뒤 재빌드: `npm run release:beta` (TestFlight) 또는 `build:ios:device`
2. 테스터가 **설정 → 품질 개선 → 익명 품질 리포트 제공**을 켜고 동의
3. 인수증을 스캔·검수·등록하면 이벤트가 쌓이고, 포그라운드 복귀/등록 시 전송됨
4. Firebase 콘솔 **Firestore → ocr_reports** 컬렉션에서 문서가 쌓이는지 확인

## 5. 수집 데이터 형태 (문서 1건 = 스캔 1회)
```jsonc
{
  "type": "ocr_scan_review", "schema": 1,
  "deviceId": "익명 UUID", "appVersion": "1.0.0",
  "engine": "apple-vision", "processingMs": 120,
  "documentConfidence": 88, "qualityScore": 0.9, "qualityPassed": true,
  "fieldCount": 8, "changedCount": 2,
  "corrections": [
    { "key": "productName", "pii": false, "changed": true,
      "editDistance": 2, "confidence": 82, "ocr": "축하3단", "final": "축하3단화환" },
    { "key": "recipientName", "pii": true, "changed": true,
      "editDistance": 1, "confidence": 74, "ocr": "○○○", "final": "○○○" }
  ]
}
```
- 비-PII 필드는 원문, PII 필드는 shape 마스킹(정체성 제거, 오류 구조는 보존).
- 학습/분석용 export: 콘솔에서 CSV/JSON 내보내기, 또는 `gcloud firestore export`.

## 6. 출시 전 필수(법적)
- 개인정보 처리방침에 **수집 항목·목적(정확도 개선)·보관기간·비식별 처리** 명시
- App Store Connect **App Privacy**를 "데이터 수집함"으로 갱신
  (수집: 진단/사용 데이터. 추적 없음. 3자 제공 없음)
- 한국 PIPA: 옵트인 동의 문구를 처리방침/동의 화면에 반영(앱 설정 토글 문구가 1차 고지)
