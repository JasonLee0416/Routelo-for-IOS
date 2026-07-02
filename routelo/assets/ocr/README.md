# Bundled PP-OCR model assets

- `ch_PP-OCRv5_det_mobile.onnx`: RapidOCR v3.8.0 PP-OCRv5 mobile detector.
- `korean_PP-OCRv5_rec_mobile.onnx`: RapidOCR v3.8.0 Korean PP-OCRv5 mobile recognizer.
- `ppocrv5_korean_dict.txt`: matching Korean recognition dictionary.

`manifest.json` is the source of truth for model version, provenance, runtime
versions, and SHA-256 hashes. Android and iOS bundle these exact files through
the same Metro asset declarations.

See `docs/adr/0001-ppocr-single-engine.md` for the architecture decision.
