# App Store 메타데이터 초안 (Routelo)

App Store Connect에 그대로 붙여넣을 수 있는 초안. 확정 후 그대로 입력하거나
`ios/fastlane/metadata/<locale>/` 트리로 옮겨 `fastlane`으로 관리할 수 있다.
`⚠️` 표시는 **사용자가 직접 정해야 하는 값**(URL·법인정보 등).

---

## 기본 정보
| 항목 | 값 |
|---|---|
| 앱 이름(App Name, 30자) | **Routelo** |
| 부제(Subtitle, 30자) | 화환 배송 기사를 위한 배달 관리 |
| 번들 ID | `com.jasonlee0312.routelo.ios` |
| 기본 언어 | 한국어 |
| 카테고리(기본/보조) | 비즈니스 / 생산성 |
| 연령 등급 | 4+ (부적절 콘텐츠 없음) |
| 가격 | 무료 (인앱 결제 없음) |

## URL (⚠️ 직접 준비)
| 항목 | 값 |
|---|---|
| 지원(Support) URL | ⚠️ 예: https://routelo.app/support (필수) |
| 마케팅 URL | ⚠️ 선택 |
| 개인정보 처리방침 URL | ⚠️ **필수** — 아래 "개인정보" 참고 |

---

## 프로모션 텍스트 (Promotional Text, 170자)
> 인수증만 찍으면 배송 정보가 자동 입력됩니다. 마감 시간 알림, 최적 동선, 수익 계산까지 — 화환 배송 기사를 위한 올인원 관리 앱.

## 설명 (Description)
```
Routelo는 화환·화분 배송 기사를 위한 배달 관리 앱입니다.
영수증(인수증)을 촬영하면 온디바이스 문자 인식으로 상품·주소·연락처·마감 시간을
자동으로 채워, 손으로 옮겨 적는 수고를 없앱니다.

■ 인수증 스캔 자동 입력
- 사진 한 장으로 상품명·배송지·수령인·연락처·예식/마감 시간 인식
- 인식 결과를 검수 화면에서 바로 수정, 애매한 값은 표시해 확인

■ 마감·예식 시간 알림
- 엄수 마감과 예식 시간을 놓치지 않도록 사전 알림
- 소리/진동/알림음 선택

■ 배달 동선
- 출발지·도착지를 저장해 두고, 배송지를 끌어 순서 조정
- 티맵·카카오맵·네이버지도로 바로 길안내 연동

■ 수익·운영비 관리
- 지역별 배송료, 주유·주행 기록으로 일/월 수익 자동 계산
- 캘린더에서 지난 배송 기록과 인수증 사진 확인

■ 프라이버시 우선
- 데이터는 기본적으로 기기 안에 저장됩니다.
- 광고 추적을 하지 않습니다.

화환 배송의 시작부터 정산까지, Routelo 하나로 관리하세요.
```

## 키워드 (Keywords, 100자, 쉼표 구분)
```
배달,화환,화분,배송,기사,배송기사,동선,경로,인수증,OCR,꽃배달,수익관리,주유
```

## 릴리스 노트 (What's New) — 1.0.0
```
Routelo 첫 출시.
- 인수증 스캔 자동 입력, 마감/예식 알림, 배달 동선, 수익 관리
```

---

## English (en-US) — 보조 로케일(선택)
- **Name**: Routelo
- **Subtitle**: Delivery manager for florists
- **Keywords**: delivery,florist,wreath,driver,route,receipt,OCR,courier,earnings
- **Description**:
```
Routelo helps flower-wreath delivery drivers manage every run. Snap a delivery
receipt and on-device text recognition fills in the product, address, contact,
and deadline automatically — no more copying by hand.

• Receipt scan autofill (product, address, recipient, contact, event time)
• Deadline & event-time reminders (sound / vibration)
• Route planning with drag reorder and Tmap/KakaoMap/Naver handoff
• Earnings & fuel tracking with daily/monthly profit
• Privacy-first: data stays on your device, no ad tracking
```

---

## 개인정보(App Privacy) 답변 초안
App Store Connect의 App Privacy 설문에 입력할 값. 코드 기준 실제 수집 범위:
- **추적(Tracking)**: 아니요 (`NSPrivacyTracking = false`)
- **수집 데이터**: 서버 전송 없음(로컬 저장). 계정을 만들면 이름/이메일을 기기에 저장.
  - 원격 서버로 개인정보를 **전송하지 않으면** "Data Not Collected"로 답할 수 있음.
  - ⚠️ 단, 향후 백업/동기화(서버 전송)를 켜면 해당 항목(연락처·주소 등)을
    "Contact Info / User Content"로 신고해야 함. 출시 시점 기능 기준으로 답할 것.
- **개인정보 처리방침 URL**: ⚠️ 필수. 최소 항목:
  - 어떤 데이터를(주문·주소·연락처·사진) 왜(배달 관리) 저장하는지
  - 기기 로컬 저장이며 제3자 제공/광고추적 없음
  - 데이터 삭제 방법(앱 삭제 또는 앱 내 삭제)
  - 문의 연락처
