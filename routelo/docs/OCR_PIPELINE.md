# RouteLO OCR Pipeline

> `Routelo for IOS` keeps RouteLO's shared parser and review-first data model,
> but changes the iOS recognition priority to Apple Vision -> consented CLOVA
> fallback -> manual input. Android and diagnostic offline paths may still use
> the shared PP-OCRv5 candidate.

## 1. Shared OCR boundary

All OCR engines must produce the same evidence shape:

```text
imageUri
  -> recognizer-specific OCR
  -> fullText + line boxes + confidence
  -> layout reconstruction
  -> normalizeReceipt
  -> parseReceiptText
  -> human review
  -> local receipt/delivery record
```

No engine is allowed to write trusted delivery fields directly.

## 2. iOS recognition priority

```text
1. Apple Vision OCR
2. CLOVA OCR fallback
   - only after explicit user consent
   - only when Apple Vision fails or required fields are missing/weak
3. Manual input
```

PP-OCRv5 remains available as a shared Android/iOS candidate and benchmark
baseline, but the default iOS product route stops at manual input when Apple
Vision and consented CLOVA do not produce enough evidence.

## 3. Recognizer contract

Implemented recognizer contract:

```ts
type ReceiptRecognizer = {
  id: string;
  engine: 'apple-vision' | 'ppocrv5' | 'clova';
  platforms: Array<Platform.OS>;
  priority: number;
  recognize(imageUri: string, context?: ReceiptRecognizerContext): Promise<ReceiptRecognizerResult>;
};
```

Current candidates:

| Recognizer | Role |
|---|---|
| `appleVisionRecognizer` | iOS primary local OCR, native bridge pending |
| `clovaRecognizer` | consented cloud fallback, HTTP adapter pending |
| `ppocrRecognizer` | shared PP-OCRv5 ONNX candidate, Android default and iOS diagnostic candidate |

## 4. Capture quality gate

OCR must not start when a required quality condition fails.

- Blur: Laplacian variance or ML-based sharpness score.
- Brightness: mean luminance and clipped black/white pixel ratio.
- Shadow: local illumination variance across document quadrants.
- Coverage: detected document polygon relative to the camera frame.
- Cropping: polygon points touching the frame boundary.
- Skew: document edge angles and text baseline angle.
- Resolution: effective character height and document pixel area.

Suggested automatic capture conditions:

- document coverage 65-92%;
- all four corners visible;
- blur score at least 70;
- brightness score at least 65;
- skew under 8 degrees;
- stable device motion for 400-800 ms.

## 5. Preprocessing variants

Preserve the original image and generate independent OCR candidates:

1. original crop;
2. illumination-corrected image;
3. CLAHE contrast image;
4. perspective and deskew corrected image;
5. adaptive-threshold image;
6. denoised and sharpened image.

Do not select a single image globally. Select the best OCR block or field
candidate across variants. Avoid aggressive binarization when thin Korean
strokes disappear.

## 6. Candidate scoring

Each field receives a 0-100 score.

```text
score =
  OCR confidence * 0.20
  + regex validity
  + keyword proximity
  + document position
  + cross-field consistency
  + external validation
  - ambiguity penalty
  - logical error penalty
```

- 85-100: confirmed automatically;
- 60-84: user review;
- 40-59: strong warning;
- below 40: do not auto-fill.

Document confidence is the weighted average of required fields, with the
lowest required-field score receiving extra weight.

## 7. CLOVA consent and privacy

CLOVA fallback is allowed only when:

1. the user explicitly enables cloud fallback;
2. the app explains that receipt image/text may leave the device;
3. the request sends only the minimum required receipt data;
4. returned values are labeled as cloud-derived evidence;
5. the user reviews the result before registration.

## 8. Manual input rule

If required fields remain missing after the allowed recognizers:

- do not fabricate values;
- do not reuse fixtures;
- preserve recognized/unmapped evidence;
- show the missing required fields;
- route the user to manual input.

## 9. Database tables

- `delivery_receipts`: receipt metadata, image hashes, status, created time.
- `ocr_raw_results`: engine, variant, raw blocks, confidence, processing time.
- `extracted_fields`: selected value, confidence, validation status.
- `field_candidates`: all candidate values, bounding boxes, evidence scores.
- `user_corrections`: predicted value, corrected value, anonymized context.
- `receipt_templates`: vendor/template fingerprint and learned field regions.
- `address_candidates`: OCR address, normalized address, coordinates, validation score.

Relations: one receipt has many raw results, extracted fields, candidates,
corrections, and address candidates. Templates are associated by vendor and
visual fingerprint.

## 10. MVP priority

1. Apple Vision native bridge for iOS.
2. CLOVA adapter with secure secret injection.
3. Cloud fallback consent UI.
4. Apple Vision / CLOVA / PP-OCR benchmark harness.
5. Shared parser validation through `normalizeReceipt` and `parseReceiptText`.
6. Physical iPhone validation and TestFlight readiness.
