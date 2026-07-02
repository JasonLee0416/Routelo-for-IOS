export const PP_OCR_MODEL_VERSION = 'rapidocr-v3.8.0-ppocrv5';

export const PP_OCR_MODEL_MANIFEST = {
  detector: {
    file: 'ch_PP-OCRv5_det_mobile.onnx',
    sha256: '4d97c44a20d30a81aad087d6a396b08f786c4635742afc391f6621f5c6ae78ae',
  },
  recognizer: {
    file: 'korean_PP-OCRv5_rec_mobile.onnx',
    sha256: 'cd6e2ea50f6943ca7271eb8c56a877a5a90720b7047fe9c41a2e541a25773c9b',
  },
  dictionary: {
    file: 'ppocrv5_korean_dict.txt',
    sha256: 'a88071c68c01707489baa79ebe0405b7beb5cca229f4fc94cc3ef992328802d7',
  },
} as const;
