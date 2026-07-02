# Routelo split PR merge plan

This series replaces the broad Draft PR #14 with reviewable, validated
work units. All required PRs target `main` and are stacked. Merge them in
the exact order below. After each merge, the next PR diff should shrink
automatically.

## Required merge order

1. [#24 CI quality gates](https://github.com/JasonLee0416/Routelo.version_2/pull/24)
2. [#25 Canonical data contracts](https://github.com/JasonLee0416/Routelo.version_2/pull/25)
3. [#23 Storage repositories and migration](https://github.com/JasonLee0416/Routelo.version_2/pull/23)
4. [#22 Android safe-area insets](https://github.com/JasonLee0416/Routelo.version_2/pull/22)
5. [#28 OCR zero-fabrication boundary](https://github.com/JasonLee0416/Routelo.version_2/pull/28)
6. [#29 Bundled Android ML Kit recognizer](https://github.com/JasonLee0416/Routelo.version_2/pull/29)
7. [#26 Reproducible OCR dataset benchmark](https://github.com/JasonLee0416/Routelo.version_2/pull/26)
8. [#27 Provenance-aware typed OCR extraction](https://github.com/JasonLee0416/Routelo.version_2/pull/27)
9. [#31 Guest/member and vehicle-profile foundation](https://github.com/JasonLee0416/Routelo.version_2/pull/31)
10. [#32 Repository, onboarding, and calendar integration](https://github.com/JasonLee0416/Routelo.version_2/pull/32)
11. [#30 District fees, profit calendar, and persisted theme](https://github.com/JasonLee0416/Routelo.version_2/pull/30)
12. [#33 Android native debug-build CI](https://github.com/JasonLee0416/Routelo.version_2/pull/33)
13. [#35 Shared Android/iOS platform foundation](https://github.com/JasonLee0416/Routelo.version_2/pull/35)

## Experimental tail

[#34 Guarded PP-OCRv5 experiment](https://github.com/JasonLee0416/Routelo.version_2/pull/34)
is intentionally Draft and is not required for the production ML Kit
baseline. It supersedes closed PR #11. Keep it Draft until Issue #7's
accuracy, post-processing, memory, and physical-device gates pass.

## Review protocol

For each required PR:

1. Confirm the PR is mergeable and its diff contains only its remaining
   work unit after lower PRs have merged.
2. Confirm `Quality` passes.
3. For #33 and later, confirm the Android debug APK workflow passes.
4. For #35, confirm the iOS Simulator workflow passes.
5. Merge using the repository's normal merge method.
6. Do not close hardware- or backend-dependent issues unless their
   acceptance evidence is attached.

## Issue state after the required series

- #15 and #17: implementation is landed.
- #12: code landed; physical Galaxy navigation evidence still required.
- #13: code landed; physical camera/no-text evidence still required.
- #16: typed/provenance safety landed; geometry-based association and
  field-level ground truth remain.
- #18: calendar UI landed; physical navigation and conflict-risk coverage
  remain.
- #8: local account foundation landed; backend authentication, secure
  sessions, cloud migration, and billing remain.
- #20: requested first-pass product changes landed; physical address/OCR
  and full dark-theme review remain.
- #21: shared platform boundary and build scaffolding landed; the Swift
  iOS ML Kit adapter and physical iPhone validation remain.

## Superseded work

After all required PRs are merged and checks are green:

- close Draft PR #14 as superseded by this split series;
- keep PR #11 closed in favor of Draft PR #34;
- retain Issue #36 as the maintenance process record.

## Validation baseline

The top required branch passed:

- Jest: 31 tests across 8 suites;
- TypeScript;
- Expo Doctor: 21/21;
- Expo web export;
- local iOS Expo prebuild.

GitHub Actions provides the authoritative Android and iOS native build
results because the local preparation host does not have an Android
toolchain or full Xcode installation.
