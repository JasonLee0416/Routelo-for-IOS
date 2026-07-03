# LUCENT — Routelo 디자인 시스템

> "빛을 통과시키되 콘텐츠를 흐리지 않는 **기능적 유리(Functional Glass)**."
> Apple Liquid Glass의 *철학*(투명·깊이·유동·콘텐츠 중심·부드러운 상호작용)만
> 가져와 독자 시스템으로 재해석했다. 유리는 **장식이 아니라 조작 레이어를
> 콘텐츠 위로 띄우는 기능**이다.

**토큰 소스 (single source of truth)**
- `app/theme/tokens.ts` — `RADIUS`, `GLASS`, `GLASS_ROLE`, `concentricRadius`
- `app/theme/GlassSurface.tsx` — 유리 프리미티브 + `useReduceTransparency` / `useReduceMotion`
- `app/theme/color.ts` — `withAlpha`
- `app/index.tsx` — `LIGHT` / `DARK` 팔레트(`Palette` 키)

핵심 원칙: **컬러·Radius·Glass 강도·모션은 모두 시맨틱 토큰**으로 관리하고, 컴포넌트는
raw 값이 아니라 토큰만 참조한다.

---

## 1. 컬러 (iOS 시스템 컬러 기반)

semantic dynamic color 우선, hex는 크로스플랫폼 폴백. 상태는 **색 + 아이콘 + 텍스트**를
함께 써서 색맹/고대비에서도 구분된다.

| 역할 | Light | Dark | iOS dynamic |
|---|---|---|---|
| **Primary / 정보** | `#0A84FF` | `#0A84FF` | `systemBlue` |
| 긴급(마감 지남) | `#FF453A` | `#FF453A` | `systemRed` |
| 임박 | `#FF9F0A` | `#FF9F0A` | `systemOrange` |
| 완료 | `#34C759` | `#34C759` | `systemGreen` |
| Text (label) | `#1C1C1E` | `#F5F5F7` | `label` |
| Text muted | `#6B6B70` | `#AEAEB2` | `secondaryLabel` |
| Surface(콘텐츠) | `#FFFFFF` | `#1C1C1E` | `secondarySystemGroupedBackground` |
| SurfaceAlt | `#EDEFF4` | `#2C2C2E` | `tertiarySystemGroupedBackground` |
| Background | `#F4F6FA` | `#000000` | `systemGroupedBackground` |
| Separator | `#D8DADF` | `#48484A` | `separator` |

뉴트럴은 순회색이 아니라 **블루 편향**(#6B6B70) — "선택된" 중립.

## 2. Radius (Continuous Corner)

Apple의 continuous-corner(`RoundedRectangle(cornerRadius:style:.continuous)`)에 가까운
부드러운 곡률을 목표로 한다. `app/theme/tokens.ts`:

```ts
export const RADIUS = {
  // base
  none: 0, xs: 6, sm: 10, md: 14, lg: 18, xl: 24, xxl: 32, xxxl: 40, pill: 999,
  // semantic
  smallButton: 12, button: 16, largeButton: 20, chip: 999, input: 16,
  searchBar: 20, card: 24, glassCard: 28, modal: 32, bottomSheet: 32,
  floatingNav: 36, fab: 999,
} as const;
```

**Concentric 규칙** — `childRadius = parentRadius − padding` (`concentricRadius(parent, pad)`):

| 부모 | radius | padding | 자식 radius |
|---|--:|--:|--:|
| Floating nav | 36 | 8 | **28** (탭 pill) |
| Bottom sheet | 32 | 18 | **14** (내부 데이터 셀) |
| Content card | 24 | 16 | **8~14** |

## 3. Glass Strength (시맨틱 강도 토큰)

숫자 하나가 아니라 SwiftUI `.glassEffect(.regular/.clear)` 처럼 **강도 단계**로 관리한다.
`GLASS`(`app/theme/tokens.ts`):

| token | blur | bg | tint | stroke | shadow | highlight | 용도 |
|---|--:|--:|--:|--:|--:|--:|---|
| **none** | — | 솔리드 | — | — | — | — | 중요 데이터: 시간·마감·OCR·폼 카드 |
| **subtle** | 12 | .72 | .06 | .16 | .10 | .10 | 검색바·보조 컨트롤 |
| **regular** | 20 | .58 | .10 | .22 | .16 | .16 | 툴바·모달·바텀시트·필터칩 (기본) |
| **prominent** | 28 | .46 | .14 | .30 | .24 | .22 | 플로팅 내비·FAB·핵심 조작 |
| **clear** | 36 | .28 | .08 | .34 | .28 | .28 | 장식 hero·미디어 오버레이 (텍스트 금지) |

**조작 레이어 매핑** (`GLASS_ROLE`, 앱 실제 적용):

| 컴포넌트 | radius | glass | 상태 |
|---|---|---|---|
| 하단 플로팅 내비 | `floatingNav 36` | **prominent** | ✅ |
| FAB(직접 추가) | `fab 999` | **prominent** | ✅ |
| 배달 상세 시트 | `bottomSheet 32` | **regular** | ✅ |
| 검색바 | `searchBar 20` | **subtle** | ✅ |
| 툴바/헤더 · 폼 모달 | — | **none(솔리드)** | 가독성 우선(규칙 8) |
| 콘텐츠 카드 | `card 24` | **none(솔리드)** | ✅ |

### 규칙
1. 중요 정보 카드에 유리를 남발하지 않는다.
2. 텍스트가 많은 영역에 `clear`를 쓰지 않는다.
3. glass 강도는 radius와 함께 시맨틱 토큰으로 관리한다.
4. 모든 glass surface는 continuous corner를 쓴다.
5. 플로팅 내비 = radius 36(또는 pill) + **prominent**.
6. 툴바·모달·바텀시트 = **regular**.
7. 검색·보조 필터 = **subtle**(또는 regular).
8. 배송 시간·예식·긴급·OCR 데이터는 **solid** 우선.
9. Reduce Transparency / 고대비에서 glass → **solid 자동 대체**.

## 4. 타이포그래피

`-apple-system / SF Pro / Pretendard / system-ui`, 데이터는 **`tabular-nums`**.
핵심 수치(남은 건수·순익·엄수 시간)는 큰 크기 + 800~850 weight + 고대비, 보조는 작게·저대비.

## 5. 모션 (RN `Animated`, 네이티브 드라이버)

- **손익 바 상승** — 탭 열림/기간 변경 시 `height 0→값`, 왼→오 스태거 웨이브(Easing.out cubic).
- **네비 파동** — 탭 누르면 버튼 중심에서 원이 `scale 0.35→1.7` + `opacity 0.22→0`.
- 둘 다 `useReduceMotion()` 존중 — 바는 즉시 최종값, 파동 생략.

## 6. 접근성

- **투명도 감소** — `useReduceTransparency()` → `GlassSurface`가 blur 제거 + 솔리드 표면으로 대체.
- **모션 감소** — `useReduceMotion()` → 애니메이션 생략.
- 상태는 색만이 아니라 **아이콘 + 텍스트** 병행. 텍스트는 유리 위가 아니라 **세미솔리드 콘텐츠** 위에.
- 최소 44px 터치 타깃, `prefers-reduced-motion`/포커스 상태 존중.

## 7. `GlassSurface` 사용법

```tsx
import { GlassSurface } from './theme/GlassSurface';
import { RADIUS } from './theme/tokens';

<GlassSurface
  strength="prominent"          // subtle | regular | prominent | clear
  radius={RADIUS.floatingNav}   // continuous-corner 토큰
  dark={dark}                   // useTheme().dark
  colors={{ surface: C.surface, primary: C.primary, outline: C.outline }}
>
  {/* 컨트롤 콘텐츠 (Reduce Transparency 시 자동 솔리드) */}
</GlassSurface>
```
- 콘텐츠 카드에는 **쓰지 않는다** — 솔리드 `View(backgroundColor: C.surface)`.
- 네이티브: `expo-blur`의 `BlurView` + tint/edge-light/highlight/shadow 합성.

## 8. 플랫폼 토큰 예시

```swift
// SwiftUI — dynamic 우선, continuous corner, glass 시맨틱
Color(.systemBlue); Color(.label); Color(.separator)
Rectangle().clipShape(.rect(cornerRadius: 24, style: .continuous))
view.glassEffect(.regular, in: .rect(cornerRadius: 32, style: .continuous))
```
```kotlin
// Jetpack Compose — dynamicColorScheme 우선, 토큰 radius
val Brand = Color(0xFF0A84FF)
Surface(shape = RoundedCornerShape(24.dp)) { /* content solid */ }
Modifier.hazeChild(haze, HazeStyle(blurRadius = 28.dp, /* prominent */))  // dev.chrisbanes.haze
```
```dart
// Flutter — CupertinoDynamicColor, ContinuousRectangleBorder
const primary = CupertinoDynamicColor.withBrightness(
  color: Color(0xFF007AFF), darkColor: Color(0xFF0A84FF));
ShapeDecoration(shape: ContinuousRectangleBorder(borderRadius: BorderRadius.circular(24)));
```
```css
/* CSS — light-dark() 우선, backdrop-filter glass */
:root{ color-scheme: light dark; --primary: light-dark(#0A84FF,#0A84FF); }
.g-regular{ backdrop-filter: blur(20px) saturate(1.5);
  background: rgba(255,255,255,.58); border:1px solid rgba(255,255,255,.22); }
```

---

인터랙티브 프로토타입(라이트/다크·투명도 감소·모션 데모)은 claude.ai Artifact로 별도 제공.
