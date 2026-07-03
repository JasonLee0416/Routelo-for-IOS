# Routelo for IOS OCR Pipeline

## Goal

The iOS OCR pipeline should maximize receipt recognition quality without
weakening RouteLO's zero-fabrication rule. OCR engines may propose candidates,
but only the shared RouteLO parser and review workflow may turn evidence into
delivery data.

## Default iOS priority

```text
1. Apple Vision OCR
2. CLOVA OCR fallback when:
   - Apple Vision fails, or
   - required fields are missing, or
   - document confidence is below the release threshold,
   AND the user explicitly consents to cloud fallback
3. Manual input / review
```

## Recognizer contract

All OCR providers must implement the same `ReceiptRecognizer` contract:

- `id`
- `engine`
- `platforms`
- `priority`
- `recognize(imageUri, context)`

Current recognizer candidates:

| Recognizer | Platform | Default role |
|---|---|---|
| `appleVisionRecognizer` | iOS | primary high-precision local OCR |
| `clovaRecognizer` | iOS/Android | consented cloud fallback |
| `ppocrRecognizer` | iOS/Android | shared offline candidate, Android default, iOS diagnostic/parity candidate |

The iOS default route intentionally does not auto-accept PP-OCR after Apple
Vision/CLOVA failure. If both preferred iOS paths fail, the app should move to
manual input unless a product decision explicitly enables PP-OCR as an iOS
secondary local fallback.

**Interim decision (2026-07-03, walking skeleton):** while the native Apple
Vision bridge and the CLOVA HTTP adapter are still unimplemented placeholders,
that product decision is taken — PP-OCRv5 runs as the interim iOS fallback after
Apple Vision and consented CLOVA fail, before manual input. This is gated by the
single `IOS_INTERIM_PPOCR_FALLBACK` toggle in `app/platform/receiptRecognition.ts`
and only affects the active execution chain; the recognizer contract default
(`recognizersForPlatform('ios')` without options) stays Apple Vision -> CLOVA.
Flip the toggle off once Apple Vision is the working primary path.

## Shared parser boundary

Every engine result must be converted into:

```ts
{
  engine: 'apple-vision' | 'ppocrv5' | 'clova';
  fullText: string;
  lines: RecognizedLine[];
  processingMs: number;
}
```

Then it must flow through the same shared parser:

```text
recognized text
  -> layout reconstruction when boxes exist
  -> normalizeReceipt
  -> parseReceiptText
  -> confidence scoring
  -> human review
```

No engine may bypass `normalizeReceipt` or `parseReceiptText`.

## CLOVA fallback rules

CLOVA is allowed only when all conditions are true:

1. the user enabled cloud OCR fallback;
2. the app explains that receipt data may leave the device;
3. the app records the current consent notice version with the request;
4. the request sends the minimum required image/text data;
5. no automatic field overwrite occurs without review;
6. the fallback result is labeled as cloud-derived provenance.

## Manual input rule

If required fields remain missing after Apple Vision and consented CLOVA:

- do not fabricate values;
- do not reuse demo fixtures;
- keep the OCR evidence and warnings visible;
- route the user to manual field entry.

## Implementation checklist

- [x] Add `ReceiptRecognizer` contract.
- [x] Keep shared PP-OCR recognizer as a common candidate.
- [x] Add Apple Vision recognizer placeholder for iOS.
- [x] Add CLOVA recognizer placeholder with consent guard.
- [x] Enable PP-OCR as the interim iOS fallback (walking skeleton, `IOS_INTERIM_PPOCR_FALLBACK`).
- [ ] Implement native iOS Vision bridge.
- [ ] Add CLOVA HTTP adapter and secure secret injection.
- [ ] Add UI consent copy for cloud fallback.
- [ ] Add benchmark comparing Apple Vision, PP-OCR, and CLOVA on the same receipt set.
- [ ] Add iPhone physical-device validation evidence.

