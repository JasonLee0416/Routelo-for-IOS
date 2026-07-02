# Routelo for IOS Project Handoff

## Repository

- New project name: **Routelo for IOS**
- GitHub slug: `Routelo-for-IOS`
- Source repository: `JasonLee0416/Routelo.version_2`
- Source baseline: `origin/main` at `71d119b4f94aeaf04fd0d58f70cee520e05de75f`

## Why this project exists

The original RouteLO project evolved into a cross-platform delivery management
prototype. This repository is a clean iOS launch fork that preserves the
product workflow while making the iOS OCR path explicit:

```text
Apple Vision OCR
  -> user-consented CLOVA OCR fallback
  -> manual input
  -> shared RouteLO normalizeReceipt / parseReceiptText
```

## Do not reintroduce

- old Android ML Kit native modules;
- `routelo/modules/my-module`;
- `routelo/modules/routelo-mlkit`;
- demo fixture auto-fill;
- silent OCR field fabrication;
- cloud OCR upload without consent.

## Keep from the existing RouteLO codebase

- settings v2 contracts and migration;
- district fee settings and profit calendar;
- route stack / selected navigation app handoff;
- vendor verification abstraction;
- PP-OCRv5 assets as shared offline candidate;
- OCR provenance and review UI;
- EAS iOS device-test workflow.

## Current OCR design

`routelo/app/platform/receiptRecognizers.ts` defines:

- `ReceiptRecognizer`
- `ppocrRecognizer`
- `appleVisionRecognizer`
- `clovaRecognizer`
- `recognizersForPlatform`

The Apple Vision and CLOVA recognizers are intentionally guarded placeholders.
They define the safe pipeline before native/cloud credentials are connected.

## Next recommended issues

1. Implement the native iOS Apple Vision bridge.
2. Add user-facing CLOVA cloud fallback consent UI.
3. Add CLOVA adapter with secure secret injection.
4. Run a shared benchmark over Apple Vision / PP-OCR / CLOVA.
5. Validate on a physical iPhone before TestFlight.

