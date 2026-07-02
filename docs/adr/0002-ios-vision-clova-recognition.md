# ADR 0002: iOS OCR priority uses Apple Vision before cloud fallback

- Status: Accepted for `Routelo for IOS`
- Date: 2026-07-02

## Context

The original RouteLO v2 codebase moved toward a shared PP-OCRv5 runtime for
Android and iOS. For the iOS launch project, we want to use the strongest
native iPhone OCR option first while preserving RouteLO's shared parser and
zero-fabrication rules.

## Decision

The iOS app uses this default OCR priority:

1. Apple Vision OCR
2. CLOVA OCR only when Apple Vision fails or required fields are missing, and
   only after explicit user consent
3. Manual input

PP-OCRv5 remains a shared Android/iOS candidate for parity, diagnostics, and
possible future offline fallback experiments, but it is not the default iOS
route after Apple Vision/CLOVA failure.

All OCR outputs must flow through `normalizeReceipt` and `parseReceiptText`.

## Consequences

- iOS launch work must implement an Apple Vision native bridge.
- CLOVA requires consent UI and secure secret injection.
- Manual input remains a first-class safety path.
- The parser and review UI stay shared across OCR engines.
