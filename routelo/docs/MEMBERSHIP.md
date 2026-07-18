# 회원 자격 관리 (Pro/무료 원격 통제) — 1단계

운영자(Jason)가 **누가 Pro이고 누가 무료인지** 중앙에서 보고 통제하기 위한 회원
자격 레이어. 텔레메트리와 동일하게 **Firestore REST**만 쓰고 네이티브 SDK가 없다.
**로컬 우선** 원칙을 지키며, 원격 자격은 로컬 요금제를 override 하는 방식으로만
작동한다.

## 핵심 동작

- **미설정(기본)**: `app/membership/config.ts`의 `projectId`/`apiKey`가 비어 있으면
  **완전 무동작** → 기존 로컬(파운딩 Pro) 그대로. 즉 이 기능을 머지해도 **즉시
  바뀌는 동작은 없다.**
- **설정 후(관리 모드)**: 앱 실행/포그라운드 복귀 시 `members/{deviceId}`를 조회한다.
  - **등록됨(found)** → 운영자가 지정한 `plan`을 그대로 적용(승격/강등 권위).
  - **미등록(absent)** → **무료로 자기등록**하고 무료 적용. (운영자가 콘솔에서 승격)
  - **오류(offline/서버)** → **강등 금지**, 마지막 로컬 요금제 유지.

## 데이터 모델 (`members` 컬렉션)

문서 ID = 익명 설치 ID(`routelo.telemetry.deviceId`, 텔레메트리와 동일 기기 식별자).

```
members/{deviceId} {
  label:     "호준 형",              // 앱 온보딩 표시 이름(별명). 식별용.
  plan:      "free" | "pro",
  note:      "베타 3기",             // 운영자 메모(선택)
  updatedAt: "2026-07-18T..."        // ISO
}
```

> PII 최소화: 전화·주소는 저장하지 않는다. `label`은 사용자가 온보딩에 넣은
> 표시 이름(별명)뿐이다.

## 운영자 사용법 (개발 없이 Firebase 콘솔에서)

1. `config.ts`에 본인 Firebase `projectId`/`apiKey`를 채워 커밋(텔레메트리와 같은
   값 재사용 가능, 컬렉션만 `members`).
2. 베타 사용자가 앱을 켜면 `members` 컬렉션에 `{label, plan:"free"}`로 자동 등장.
3. Firebase 콘솔 → Firestore → `members`에서 해당 문서의 `plan`을 **`pro`로 변경**.
4. 그 사용자의 앱이 다음 실행/포그라운드 복귀 때 **Pro로 전환**된다.
   - 사용자를 못 찾겠으면, 사용자에게 **설정 > 멤버십 > 내 기기 ID**를 물어보면 된다.

## Firestore 보안 규칙 (권장)

클라이언트는 **자기 문서 읽기 + 최초 생성(무료)만** 허용하고, `plan` 승격은
콘솔/운영자만 하도록 잠근다. (베타에서 규칙 없이 열어두면 자기등록 plan을 조작할
수 있으니, 최소한 아래처럼 생성 시 `plan`을 `free`로 강제할 것.)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /members/{deviceId} {
      allow get: if true;                         // 자기 자격 조회
      allow create: if request.resource.data.plan == 'free';  // 자기등록은 무료만
      allow update, delete: if false;             // 승격/강등은 콘솔(운영자)만
    }
  }
}
```

## 보안 한계 (솔직히)

- 로컬 요금제 값은 사용자가 조작 가능(암호학적 강제 아님). 온라인 동기화 시
  원격이 권위라 **다음 접속에서 교정**되지만, 오프라인 동안은 로컬이 이긴다.
- 이는 **베타(지인 배포)**엔 충분하다. **공개 유료** 단계에서는 Apple 정책상
  디지털 잠금해제에 **IAP(StoreKit)** 가 의무이므로, 그때 RevenueCat 등으로 전환하고
  이 회원 리스트는 **comp(무료 증정) 관리용**으로 남긴다.

## 코드 맵

| 파일 | 역할 |
|---|---|
| `app/device/installId.ts` | 익명 설치 ID(텔레메트리와 공유) |
| `app/membership/config.ts` | 백엔드 설정 + 관리 모드 on/off + 기본 요금제 |
| `app/membership/schema.ts` | 타입(MemberRecord·FetchResult·Resolution) |
| `app/membership/firestore.ts` | REST 조회/자기등록 + Firestore 값 디코딩 |
| `app/membership/resolve.ts` | 자격 결정 순수 함수(found/absent/error) |
| `app/membership/index.ts` | 오케스트레이터 `syncEntitlement` |
| `app/index.tsx` | 실행/포그라운드 동기화 + 설정 "멤버십" 표시 |

## 검증

`typecheck` 클린 · 테스트 **414개 통과**(회원/기기 유닛테스트 18개 추가) ·
`verify:no-mlkit` · `verify:ocr-models` 통과.

## 다음 단계(로드맵)

- **2단계**: 회원 수 늘면 초경량 admin 웹(리스트·검색·토글).
- **3단계**: 정식 유료화 시 RevenueCat/StoreKit 구독으로 전환, 본 리스트는 comp 관리.
