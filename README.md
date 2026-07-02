# Routelo for IOS

**Routelo for IOS** is the iOS-focused RouteLO project for Korean delivery
workers who need reliable receipt OCR, strict-deadline tracking, delivery
profit review, and practical route handoff on iPhone.

This repository was cloned from `JasonLee0416/Routelo.version_2` and keeps the
existing RouteLO product workflow, data contracts, settings model, delivery
dashboard, profit calendar, and review-first OCR philosophy. The main
difference is the iOS launch pipeline: OCR starts with Apple Vision, falls back
to CLOVA only with explicit user consent, and then routes all text through the
shared RouteLO normalization layer.

## iOS OCR Pipeline

```text
Receipt image
  -> capture quality gate
  -> Apple Vision OCR on iOS
  -> if required fields are missing or confidence is too low:
       user-consented CLOVA OCR fallback
  -> if still incomplete:
       manual entry / user review
  -> Routelo shared normalizeReceipt / parseReceiptText
  -> provenance-aware field review
  -> local receipt record and delivery workflow
```

The recognizer boundary is intentionally explicit:

| Contract member | Platform | Role |
|---|---|---|
| `appleVisionRecognizer` | iOS only | primary high-accuracy iOS OCR candidate |
| `clovaRecognizer` | Android/iOS | cloud fallback only after user consent |
| `ppocrRecognizer` | Android/iOS | shared offline candidate retained for parity and diagnostics |
| `normalizeReceipt` / `parseReceiptText` | shared TypeScript | common semantic parsing and zero-fabrication review |

Default iOS priority:

1. Apple Vision OCR
2. CLOVA OCR when Apple Vision fails or required fields are missing, and only
   when the user has opted into cloud fallback
3. Manual input and review

## Product Workflow

```text
Receipt capture
  -> OCR candidate extraction
  -> Korean field normalization
  -> confidence-based human review
  -> lossless local receipt record
  -> delivery dashboard and deadline risk
  -> district-fee profit calendar
  -> route stack and selected navigation-app handoff
```

## Implemented Foundation

- Expo SDK 56 / React Native 0.85 / React 19 / TypeScript
- Material Design 3-inspired mobile dashboard
- Delivery list, route stack, notifications, settings, and profit calendar
- Settings v2 schema with grouped UI, migration, district fees, and theme mode
- Review-first OCR data model with raw text, field candidates, confidence, and
  unmapped text preservation
- PP-OCRv5 shared ONNX assets retained under `routelo/assets/ocr`
- Vendor verification boundary with opt-in Kakao local search enrichment
- iOS device-test workflow scaffolding through EAS

## Current iOS Launch Notes

- Apple Vision OCR is represented by the new `ReceiptRecognizer` contract and
  must be connected to a native iOS Vision bridge before App Store/TestFlight
  release.
- CLOVA OCR must remain opt-in. Receipt images or extracted vendor text must
  not be uploaded without explicit user consent.
- If Apple Vision and CLOVA do not produce enough evidence for required fields,
  the app must stop at manual entry instead of fabricating data.
- Shared normalization must remain the single semantic parser:
  `normalizeReceipt` / `parseReceiptText`.

## Run Locally

The app source is under [`routelo/`](routelo).

```bash
cd routelo
npm install
npm run ios
```

Useful checks:

```bash
npm run verify:ocr-models
npm run test:ci
npm run typecheck
npm run doctor
```

## Documentation

- [iOS OCR pipeline](routelo/docs/IOS_OCR_PIPELINE.md)
- [shared OCR architecture](routelo/docs/OCR_PIPELINE.md)
- [project handoff](docs/PROJECT_HANDOFF.md)
- [project roadmap](todo.md)
- [project evolution](docs/PROJECT_EVOLUTION.md)

## Repository Notice

This repository is a fresh iOS-focused project cloned from the existing
RouteLO v2 codebase. Keep Android-specific legacy native modules out of this
repo. Any iOS OCR change should preserve:

- no silent OCR fabrication;
- source/provenance review;
- local-first storage by default;
- explicit consent for cloud fallback;
- one shared normalization path after OCR text recognition.

## License

[MIT](routelo/LICENSE)
