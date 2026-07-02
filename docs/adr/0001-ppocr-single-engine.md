# ADR 0001: PP-OCRv5 is the single on-device OCR engine

- Status: Superseded for `Routelo for IOS` by ADR 0002
- Date: 2026-06-24

## Context

RouteLO needs the same offline receipt recognizer on Android and iOS. The
previous production path used an Android-only ML Kit module, while a separate
PP-OCR experiment duplicated preprocessing and decoding in Kotlin.

For the dedicated iOS launch project, Apple Vision OCR is preferred as the
first iOS recognizer, with CLOVA as a consented cloud fallback. PP-OCRv5 remains
the shared offline candidate and benchmark baseline, but no longer defines the
default iOS priority.

## Decision

RouteLO uses one pinned PP-OCRv5 detector, Korean recognizer, and dictionary.
The model files live under `routelo/assets/ocr` and are identified by SHA-256.

The OCR pipeline is shared TypeScript:

1. image decoding and normalization;
2. detector tensor inference;
3. DB probability-map region extraction and unclip;
4. receipt crop preparation;
5. recognizer tensor inference;
6. Korean dictionary CTC decoding;
7. semantic normalization and review.

Android and iOS both use the official ONNX Runtime React Native JSI binding.
No platform-specific recognizer implementation is permitted. Web exposes only
the explicit fixture path and never substitutes fabricated native output.

The published ONNX Runtime React Native 1.24.3 package requires a repository
patch for Gradle 9 compatibility, deterministic native dependency versions,
and Android package metadata. `patch-package` reapplies this during installs.

## Consequences

- Android and iOS consume identical models and OCR source code.
- Native builds become larger because ONNX Runtime and model assets are
  bundled.
- Model changes require a manifest version and SHA-256 update.
- The CI model smoke test must pass before native builds run.
- ML Kit code and dependencies are rejected by `verify:no-mlkit`.
