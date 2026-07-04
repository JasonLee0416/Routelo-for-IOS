# Apple Vision 인식 측정 키트 (맥에서 before/after)

Apple Vision(PR1)이 실제 노이즈 있는 인수증 8장에서 PP-OCR 대비 얼마나 나은지를
**맥에서 시뮬레이터·앱 빌드 없이** 측정한다. `VNRecognizeTextRequest`는 macOS 네이티브라
명령줄 Swift로 바로 실행되며, 앱의 네이티브 모듈과 **동일한 설정**(`.accurate`, `ko-KR/en-US`,
domain `customWords`, EXIF orientation)을 쓴다. 그 출력을 앱의 실제 파서(`parseReceiptText`)에
통과시켜 필드 추출을 PP-OCR baseline과 나란히 비교한다.

## 요구
- macOS **13+**(한글 인식), Xcode 또는 Command Line Tools(= `swift` 사용 가능)
- 레포 클론 + `cd routelo && npm install` (파서 테스트 실행용)

## 1) Apple Vision으로 8장 인식 → JSON
레포 루트에서:
```bash
swift routelo/tools/vision-ocr/vision-ocr.swift KakaoTalk_20260621_070828835*.jpg \
  > routelo/docs/ocr-benchmark/2026-07-04/vision-results.json
```
- 진행 로그는 stderr로, 결과 JSON은 stdout으로 나온다(위처럼 리다이렉트).
- `vision-results.json` 형식: `[{ image, imageWidth, imageHeight, lines:[{text, confidence, box:{x,y,w,h}}] }]`
  (box는 Vision 원본 = 정규화·좌하단; 파서 하네스가 `visionBoxToPixels`로 변환).

## 2) before/after 비교 실행
```bash
cd routelo
npx jest visionBenchmark
```
- `vision-results.json`이 있으면 "Apple Vision vs PP-OCR before/after" 테스트가 활성화되어
  이미지별 **필수필드(배송일/상품명/배송주소) 채움 수**와 총합을 출력한다.
- 없으면 PP-OCR baseline만 출력(현재 상태). PP-OCR baseline "before"는
  `docs/ocr-benchmark/2026-07-04/pp-ocr-lines.json`(7-04 실측)에서 온다.

## 3) 읽는 법
출력 예:
```
R00: PP req 2/3 filled 8  ->  Vision req 3/3 filled 12
...
TOTAL required filled: PP-OCR 9/24  ->  Apple Vision NN/24
```
- **required NN/3**: 필수 3필드 중 채워진 수. Apple Vision이 회전(R04)·검출누락(R01/R05)에서
  얼마나 회복하는지가 핵심 지표.
- 특정 필드 값까지 보려면 하네스의 `summarize().values`를 콘솔에 찍도록 확장하면 된다.

## 참고
- 이 CLI는 **측정용**이다. 앱 내부에서 실제로 쓰이는 경로는 `modules/apple-vision-ocr`(동일 Vision
  설정) → `app/platform/appleVision.ts`(좌표 변환·매핑) → `recognizeReceipt` 폴백 체인이다.
- 시뮬레이터에서 앱 자체를 띄워 통합까지 확인하려면 `docs/IOS_SIM_PREVIEW.md` 참고.
- 측정으로 Apple Vision 우위가 확인되면 `IOS_INTERIM_PPOCR_FALLBACK`을 유지한 채 Apple Vision을
  실주력으로 두고, PP-OCR은 최후 폴백으로 남긴다.
