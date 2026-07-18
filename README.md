# Routelo for iOS

An **iOS delivery-operations app for Korean delivery drivers** (focused on
flowers and funeral/celebration wreaths). It combines receipt OCR, route
optimization, strict-deadline management, and profit/vehicle accounting into
one app, storing all data on the device **local-first**. It is built on
**bare React Native** (no Expo) and uses **LUCENT**, an in-house design
system that reinterprets Apple's Liquid Glass philosophy. On-device testing
is done only with a **distributable Release build** that runs standalone
without Metro.

> This repository was forked to iOS from `JasonLee0416/Routelo.version_2`
> (the Android-first v2). The iOS OCR priority is
> `Apple Vision → consent-based CLOVA → PP-OCRv5 (fallback) → manual`.
> The **Apple Vision native module is implemented and measured** (pending
> in-app end-to-end verification); until then, on-device **PP-OCRv5** runs
> provisionally via `IOS_INTERIM_PPOCR_FALLBACK`.

---

## ✨ Key Features

### Delivery
- **CRUD** — register via receipt OCR · add manually · edit · delete
- **Search / filter / sort** — text search (product/address/vendor/phone/date) · status filter · by deadline or most recent
- **See at a glance** — completion progress bar · remaining expected revenue · strict-deadline approaching/overdue badges
- **Contact** — call buttons for recipient, ordering vendor, and florist (Korean number formatting) + **call-history logging** (detail sheet "Recent contacts")
- **Notifications** — **local push notifications** for strict deadlines and event times (at the configured lead minutes, `expo-notifications`)
- **Proof of completion** — **photo attachment** on delivery completion (camera/album, detail-sheet thumbnail and delete)

### OCR (receipts)
- **Apple Vision** (iOS-only native Expo module, `VNRecognizeTextRequest`) — on-device, free, no consent required. In measurements it beats PP-OCR on required fields **9/24 → 19/24** and on recipient **0/7 → 6/7** (primary recognizer)
- **PP-OCRv5** (ONNX Runtime) — the Android primary + iOS fallback. Automatic orientation correction · value validation · field heuristics · benchmark harness
- **CLOVA** — consent-based cloud fallback for low-confidence retries (decision logic ready; live calls after key issuance)
- **Ordering-vendor online cross-check** — candidate-selection UI, **sends the vendor name only (PII blocked)**, auto-disabled without a key
- Lossless preservation + **zero-fabrication** review. See the [docs](#-documentation) below for details

### Routing
- **Nearest Neighbor** suggested order + user reordering
- **Deep links** to TMAP, KakaoMap, and Naver Map + web-map fallback

### Profit · Vehicle
- Daily/weekly/monthly **profit chart** (rise animation) + **CSV export**
- **Fuel CRUD** · **odometer (mileage) CRUD** · **fuel-efficiency summary** (km/L · KRW/km)
- **Per-vehicle split** — vehicle labels on records, with a **per-vehicle breakdown** in the efficiency summary

### Data
- **Local-first** (AsyncStorage), no sample data — starts empty on first real use
- **Full data backup/restore** (JSON) — export deliveries, fuel, mileage, contacts, and settings, and restore by pasting (with overwrite confirmation)

### Design · Motion
- **LUCENT** functional-glass design — glass only on control layers (bottom nav, FAB, sheets, search); content stays solid
- Light/dark + automatic accessibility fallbacks for **Reduce Transparency / Reduce Motion**
- Profit-bar rise · nav-tab ripple (RN `Animated`, native driver)

---

## 🧱 Tech Stack

bare React Native 0.85 · React 19 · TypeScript 6 ·
onnxruntime-react-native · Apple Vision (native Swift bridge module) ·
@notifee/react-native · react-native-image-picker · react-native-fs ·
@react-native-community/blur · react-native-vector-icons ·
AsyncStorage · Jest (@react-native/jest-preset). CI: GitHub Actions ·
Build: local Xcode (`xcodebuild`, Release).

## 📁 Project Structure

```
Routelo-for-IOS/
├─ README.md                 ← this document
├─ routelo/                  ← app source (bare React Native project)
│  ├─ app/
│  │  ├─ index.tsx           screens + root component (monolithic, to be split)
│  │  ├─ theme/              LUCENT design tokens + GlassSurface + accessibility hooks
│  │  ├─ services/           pure business logic (search·sort·profit·fuel·efficiency·backup/restore·phone·contact·completion photo·deadline·notifications…)
│  │  ├─ domain/             domain models + adapters (DeliveryOrder·manual order·calendar·legacy)
│  │  ├─ repositories/       persistence contracts + AsyncStorage implementations (delivery·fuel·mileage·contact)
│  │  ├─ ocr/ + platform/    PP-OCRv5 runtime + Apple Vision mapping + recognizer contracts (Vision/CLOVA/PP-OCR)
│  │  │                      + native-compat wrappers (fs·imagePicker·imageOps·icons)
│  │  ├─ vendor/             ordering-vendor cross-check (Kakao, PII-safe)
│  │  ├─ settings/ account/  settings v2 schema + account
│  │  └─ __tests__ (per module)  46 test files · 313 tests
│  ├─ ios/                   native Xcode project (git-tracked)
│  │  └─ Routelo/            AppDelegate + AppleVisionOcr.swift + RouteloImageOps.swift
│  ├─ scripts/               build/verify scripts (build-ios-device.sh, etc.)
│  └─ docs/                  design docs (below · OCR/design/build runbooks)
└─ docs/                     top-level history (CHANGELOG · HANDOFF · EVOLUTION · ADR)
```

For detailed layers and data flow, see the **[architecture doc](routelo/docs/ARCHITECTURE.md)**.

## 🎨 Design System (LUCENT)

The token source is `routelo/app/theme/` (`tokens.ts`, `GlassSurface.tsx`, `color.ts`).
For the full spec (color/radius/glass/motion/accessibility + platform examples), see the
**[design system doc](routelo/docs/DESIGN_SYSTEM.md)**. Summary:

- **Color** — iOS system colors (Primary `#0A84FF`, urgent `#FF453A`, approaching `#FF9F0A`, done `#34C759`), light/dark
- **Radius** — continuous-corner semantic tokens (button 16 · card 24 · sheet 32 · nav 36 · pill 999) + concentric rules
- **Glass strength** — `none / subtle / regular / prominent / clear` strength tokens, mapped per control layer
- **Accessibility** — glass and motion automatically fall back to solid/still via `useReduceTransparency` / `useReduceMotion`

## 🚀 Getting Started

```bash
cd routelo
npm install
cd ios && pod install && cd ..
```

Verification (local green gate):

```bash
npm run validate     # verify:no-mlkit + verify:ocr-models + test:ci + typecheck
```

**iOS builds are done with local Xcode** (Mac required, no Metro):

```bash
npm run build:ios:device      # Release build → install and run on the connected iPhone
                              # see docs/IOS_DEVICE_TEST.md for signing setup
```

## ✅ Testing · CI

- `npm run test:ci` — 46 test files / 313 tests (focused on pure service/domain core)
- GitHub Actions `Validate Routelo iOS` — runs `test:ci · typecheck · verify:no-mlkit · verify:ocr-models` on every PR and push to main

## 🗺️ Status · Roadmap

The backlog is tracked in GitHub **issues** ([#47–#53](https://github.com/JasonLee0416/Routelo-for-IOS/issues)).

**Done** — all of the features above, **Apple Vision native OCR** (implemented + measured), **local notifications**,
**backup restore (import)**, **completion photo attachment**, **contact logging**, **per-vehicle efficiency**,
iOS release setup (encryption declaration · privacy manifest), LUCENT design port, EAS simulator build pipeline.

**Next (no spend)** —
- `index.tsx` split refactor ([#48](https://github.com/JasonLee0416/Routelo-for-IOS/issues/48))
- Apple Vision in-app end-to-end verification (Mac required, [#47](https://github.com/JasonLee0416/Routelo-for-IOS/issues/47))
- OCR **table-column reconstruction** ([#49](https://github.com/JasonLee0416/Routelo-for-IOS/issues/49))

**Pending paid resources / assets** —
- App Store icon + submission ([#52](https://github.com/JasonLee0416/Routelo-for-IOS/issues/52), Apple Developer membership)
- CLOVA/Kakao live calls + geocoding ([#53](https://github.com/JasonLee0416/Routelo-for-IOS/issues/53), paid keys)

## 📚 Documentation

- **[Architecture](routelo/docs/ARCHITECTURE.md)** · **[Design System (LUCENT)](routelo/docs/DESIGN_SYSTEM.md)**
- OCR — [pipeline](routelo/docs/OCR_PIPELINE.md) · [Apple Vision plan](routelo/docs/APPLE_VISION_OCR_PLAN.md) · [pipeline log](routelo/docs/OCR_PIPELINE_LOG.md) · [measurement report (2026-07-04)](routelo/docs/OCR_RECEIPT_TEST_2026-07-04.md) · [iOS recognizer boundaries](routelo/docs/IOS_OCR_PIPELINE.md)
- Build/run — [Mac simulator viewer runbook](routelo/docs/IOS_SIM_PREVIEW.md) · [device testing](routelo/docs/IOS_DEVICE_TEST.md)

## 🔒 Invariants (OCR)

Every iOS OCR change must uphold: ① no fabrication of OCR values (zero-fabrication) ·
② review original text/provenance · ③ local-first storage · ④ cloud fallback requires explicit consent ·
⑤ **single shared normalization** after recognition (`normalizeReceipt` / `parseReceiptText`).

## License

[MIT](routelo/LICENSE)
