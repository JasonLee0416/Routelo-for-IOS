# RouteLO 경쟁 갭 분석 (공식문서 기반)

> 작성 2026-07-10. deep-research 하네스(103 에이전트, 21 소스, 24 주장 3-0 만장일치 검증).
> 목적: 같은 부류 앱들의 표준 기능 대비 RouteLO의 누락 기능과 UX 불편점을 도출하고,
> 화환 배달 기사 워크플로우(인수증 다수 수령 → 예식/발인 시각 엄수 → 정산) 우선순위를 정한다.

## 0. 스코프 & 신뢰도 (정직 고지)

- **검증 통과(1차 공식문서, 3-0)**: 글로벌 라스트마일 기사 앱 3종
  — Onfleet, Circuit for Teams(현 Spoke Dispatch), Route4Me.
- **미검증(이번 라운드 근거 미확보)**: 한국 배달대행 라이더 앱(배민커넥트·쿠팡이츠 배달파트너·
  바로고·생각대로·만나플러스·부릉). 공식 페이지가 봇 차단/앱스토어 리다이렉트라 claim 추출 실패.
  → 아래 "카테고리 표준"은 **글로벌 기준**이며, 한국 앱 대조는 후속 라운드 필요(§6).
- 벤더 자체 문서라 기능 '존재' 입증엔 적절하나 성능 수치는 독립 벤치마크 아님.

## 1. 카테고리 표준 기능 세트 (검증됨)

| # | 표준 기능 | 근거 (1차 공식문서) |
|---|---|---|
| A | **다중 방식 배송증빙(POD)** — 사진 + **서명** + 바코드 + 메모(+동영상) + 수령결과 유형(본인/제3자/우편함/안전한 곳/기타), 일부 증빙은 완료 전 필수 강제 | onfleet.com/proof-of-delivery · support.route4me.com/proof-of-service-driver-mobile-app · getcircuit.com/teams/proof-of-delivery |
| B | **실도로·교통 기반 ETA + 다중목적지 최적화** — 도로속도/제한/과거교통 반영, ETA는 Google Distance Matrix + 센서 + ML 동적계산 | getcircuit.com/teams/features · support.onfleet.com/…/Route-Optimization-Operating · support.onfleet.com/…/Estimated-Time-of-Arrival-ETA |
| C | **시간창(time-window) 준수 최적화** — Onfleet "Always arrive on time" 모드: Complete After/Before를 엄격 준수, 못 맞추는 작업은 경로에서 자동 제외 | support.onfleet.com/…/Route-Optimization-Operating |
| D | **실시간 GPS 기사 추적 + 디스패처 동기화** — 라이브 추적(15초 비콘), 모바일→웹 실시간 반영 | getcircuit.com/teams/features · support.route4me.com/driver-mobile-app-overview |
| E | **고객 자동 도착예정 SMS/이메일 + 라이브 추적 링크** — 배차/완료/지연 시 자동, ETA 1~8h 전 사전통지, 다국어 | onfleet.com/chat-and-sms · getcircuit.com/teams/customer-notifications |
| (내비) | 앱 내장 음성 턴바이턴 **또는** 제3자 내비앱 핸드오프 + 구간별 거리/ETA | support.route4me.com/driver-mobile-app-overview |

## 2. RouteLO 갭 표

| 표준 | RouteLO 현재 | 갭 |
|---|---|---|
| A. 다중 POD(서명 포함) | 완료 **사진만** | 🔴 서명/도장 증빙 없음 — 화환 인수증 수령확인 핵심 |
| B. 실도로 ETA·최적화 | 직선거리 **NN + 수동 재정렬** | 🔴 지오코딩·실도로·교통 ETA 전무 |
| C. 시간창 최적화 | 엄수/예식 **우선표시·마감순 정렬만** | 🔴 시간을 최적화 제약으로 미사용 **(최대 갭)** |
| D. GPS·디스패처 | 현위치 GPS·동기화 없음, 로컬 단독 | 🟡 단독기사 모델이면 우선순위 낮음 |
| E. 고객 알림 | 전무 | 🔴 예식장/상가 도착예정 통지 없음 |
| 내비 | T맵/카카오/네이버 **딥링크 핸드오프** ✅ | 🟢 한국 생태계 적합(부분 충족) |

## 3. 화환 특화 — 우선순위 Top 5

화환 = "인수증 다수 수령 → 예식/발인 시각 엄수 → 정산". 시간엄수가 생명이라는 관점의 우선순위:

1. 🥇 **시간창 최적화** (표준 C) — 예식/발인 시각을 **정렬이 아니라 경로 최적화 제약**으로.
   RouteLO의 가장 결정적 갭이자 화환 핵심가치와 정확히 일치. → 별도 설계문서 `TIME_WINDOW_OPTIMIZATION_PLAN.md`.
2. 🥈 **주소→좌표 지오코딩 + 실도로 다중목적지 최적화** (표준 B) — 도심 다구간 화환 배송에 효익 큼. (todo P0)
3. 🥉 **서명/도장 증빙 캡처** (표준 A) — 사진-only → 서명 캡처 추가.
4. **고객 도착예정 알림** (표준 E) — 로컬 앱이라도 `sms:` 딥링크로 **서버 없이** "도착 N분 전" 원터치 발송 가능(연락처 보유).
5. **정산 자동집계(수수료·건별 수익) 그래프** (todo P2) — ⚠️한국 배달대행 앱들이 강하게 기대(쿠팡이츠 이용안내 스니펫상 존재, 미검증).

## 4. 즉시 개선 가능한 UX 불편점 (저비용)

- **내비 핸드오프 재실행**(라이더 커뮤니티 신호): iPhone에서 배달앱↔내비앱 오갈 때 내비가 재실행돼
  경로를 다시 찍음. → 복귀 시 현재 스톱 유지 / 전체 경유지 일괄 전달 검토.
- **원터치 연락**: 연락 기록 보유 → `tel:`/`sms:` 딥링크 버튼.
- **시간엄수 임박 경고 강화**: 마감 임박 카운트다운·색상 경고.

## 5. 반증된 주장 (기록)

- "Onfleet 사진 POD = 문앞사진 + 서명 이중증빙" → **1-2 기각**. 사진과 서명은 별개 POD 유형.

## 6. 후속 리서치 (openQuestions — 나중에 이어서)

1. **한국 배달대행 앱 표준**(배민커넥트·쿠팡이츠·바로고·생각대로·만나플러스·부릉) 공식 도움말 기준
   핵심 기능 — 이번 검증 실패. 스니펫상 실시간 배차·GPS 내장·정산 자동집계가 보이나 미검증.
2. 정산(수수료·건별 수익·그래프)이 라스트마일 **표준**인지 vs 한국 배달대행 특유 기대인지.
3. 화환 "인수증 다수 수령" → 배치 스캔/OCR + 스톱 자동생성(지오코딩) 표준 구현 방식.
4. 로컬 우선 아키텍처에서 **서버 없는 SMS 발송 경로**(sms: 딥링크 vs 백엔드).

## 7. 1차 출처 목록

- Onfleet: onfleet.com/proof-of-delivery, onfleet.com/chat-and-sms,
  support.onfleet.com/…/360023910351-Route-Optimization-Operating,
  support.onfleet.com/…/360041257971-Estimated-Time-of-Arrival-ETA
- Circuit for Teams: getcircuit.com/teams/features, /proof-of-delivery, /customer-notifications
- Route4Me: support.route4me.com/proof-of-service-driver-mobile-app,
  support.route4me.com/driver-mobile-app-overview
