/// <reference types="node" />
import fs from 'fs';
import path from 'path';

import { visionBoxToPixels } from '../../platform/appleVision';
import { buildLayoutText } from '../layout';
import { OcrFieldKey, OcrFieldResult } from '../../models';
import { inspectCaptureQuality, parseReceiptText } from '../../services/ocr';

// PP-OCR("before") = 7-04 실측 라인(리포지토리 픽스처). Apple Vision("after") =
// 맥에서 tools/vision-ocr/vision-ocr.swift 로 생성해 아래 경로에 두면 자동 비교된다.
const dir = path.resolve(__dirname, '../../../docs/ocr-benchmark/2026-07-04');
const ppocr: Array<{
  image: string;
  lines: Array<{ text: string; confidence: number; box: { x: number; y: number; width: number; height: number } }>;
}> = JSON.parse(fs.readFileSync(path.join(dir, 'pp-ocr-lines.json'), 'utf8'));

const visionPath = path.join(dir, 'vision-results.json');
const vision: Array<{
  image: string;
  imageWidth: number;
  imageHeight: number;
  lines: Array<{ text: string; confidence: number; box: { x: number; y: number; w: number; h: number } }>;
}> | null = fs.existsSync(visionPath)
  ? JSON.parse(fs.readFileSync(visionPath, 'utf8'))
  : null;

const REQUIRED: OcrFieldKey[] = ['deliveryDate', 'productName', 'deliveryAddress'];
const quality = inspectCaptureQuality({ width: 4000, height: 3000 });

function summarize(fields: OcrFieldResult[]) {
  const filled = fields.filter((f) => f.value);
  return {
    filled: filled.length,
    required: REQUIRED.filter((k) => fields.some((f) => f.key === k && f.value)).length,
    values: Object.fromEntries(filled.map((f) => [f.key, f.value])) as Record<string, string>,
  };
}

const parsePpocr = (r: (typeof ppocr)[number]) =>
  parseReceiptText(
    buildLayoutText(
      r.lines.map((l) => ({ text: l.text, boundingBox: l.box })),
      r.lines.map((l) => l.text).join('\n'),
    ),
    quality,
  );

const parseVision = (r: NonNullable<typeof vision>[number]) =>
  parseReceiptText(
    buildLayoutText(
      r.lines.map((l) => ({
        text: l.text,
        boundingBox: visionBoxToPixels(l.box, r.imageWidth, r.imageHeight),
      })),
      r.lines.map((l) => l.text).join('\n'),
    ),
    quality,
  );

describe('OCR field extraction — PP-OCR baseline (+ Apple Vision if present)', () => {
  test('parses the PP-OCR baseline for all 8 receipts', () => {
    const rows = ppocr.map((r) => {
      const s = summarize(parsePpocr(r).fields);
      return `${r.image}: filled=${s.filled} required=${s.required}/3`;
    });
    // eslint-disable-next-line no-console
    console.log('PP-OCR baseline field extraction:\n' + rows.join('\n'));
    expect(ppocr.length).toBe(8);
  });

  (vision ? test : test.skip)(
    'Apple Vision vs PP-OCR before/after (drop vision-results.json to enable)',
    () => {
      const byImage = new Map(ppocr.map((r) => [r.image, r]));
      let ppReq = 0;
      let vReq = 0;
      const rows = vision!.map((v) => {
        const pp = byImage.get(v.image);
        const ppS = pp ? summarize(parsePpocr(pp).fields) : { filled: 0, required: 0 };
        const vS = summarize(parseVision(v).fields);
        ppReq += ppS.required;
        vReq += vS.required;
        return `${v.image}: PP req ${ppS.required}/3 filled ${ppS.filled}  ->  Vision req ${vS.required}/3 filled ${vS.filled}`;
      });
      // eslint-disable-next-line no-console
      console.log(
        'BEFORE/AFTER field extraction:\n' +
          rows.join('\n') +
          `\nTOTAL required filled: PP-OCR ${ppReq}/24  ->  Apple Vision ${vReq}/24`,
      );
      expect(vision!.length).toBeGreaterThan(0);
      // 회귀 가드: Apple Vision 경로가 PP-OCR baseline보다 필수필드를 더 채워야 한다.
      expect(vReq).toBeGreaterThanOrEqual(ppReq);
    },
  );

  // Apple Vision 경로에서 수령자 이름이 정답과 일치하는지 고정(존칭 처리 + 스캔 폴백의 회귀 가드).
  const RECIPIENT_TRUTH: Record<string, string> = {
    'KakaoTalk_20260621_070828835_01.jpg': '최성인',
    'KakaoTalk_20260621_070828835_02.jpg': '박희순',
    'KakaoTalk_20260621_070828835_03.jpg': '심명철',
    'KakaoTalk_20260621_070828835_05.jpg': '구본순',
    'KakaoTalk_20260621_070828835_06.jpg': '김기회',
    'KakaoTalk_20260621_070828835_07.jpg': '유기열',
  };
  (vision ? test : test.skip)(
    'recovers recipient names from Apple Vision output (>= 6/6 known)',
    () => {
      const byImage = new Map(vision!.map((v) => [v.image, v]));
      let hit = 0;
      const total = Object.keys(RECIPIENT_TRUTH).length;
      for (const [image, name] of Object.entries(RECIPIENT_TRUTH)) {
        const v = byImage.get(image);
        if (!v) continue;
        const value =
          parseVision(v).fields.find((f) => f.key === 'recipientName')?.value || '';
        if (value.includes(name)) hit += 1;
      }
      // eslint-disable-next-line no-console
      console.log(`recipient recovery: ${hit}/${total}`);
      expect(hit).toBe(total);
    },
  );

  // 값-형식 분류(Phase 1)의 정답(ground-truth) 정확도 바닥을 고정하는 회귀 가드.
  // 값-정확일치만 카운트. baseline 14/31 → Phase 1 값-형식 스캐너로 20/31.
  const gtPath = path.join(dir, 'ground-truth.json');
  const groundTruth: Record<string, Record<string, string>> | null =
    fs.existsSync(gtPath) ? JSON.parse(fs.readFileSync(gtPath, 'utf8')) : null;
  (vision && groundTruth ? test : test.skip)(
    'ground-truth field accuracy stays >= 20/31 (Phase 1 floor)',
    () => {
      const byImage = new Map(vision!.map((v) => [v.image, v]));
      let total = 0;
      let hit = 0;
      for (const [image, truth] of Object.entries(groundTruth!)) {
        if (image.startsWith('_')) continue;
        const v = byImage.get(image);
        if (!v) continue;
        const got: Record<string, string> = {};
        parseVision(v)
          .fields.filter((f) => f.value)
          .forEach((f) => (got[f.key] = f.value));
        for (const [k, t] of Object.entries(truth)) {
          if (k === 'eventType') continue;
          total += 1;
          if (got[k] === t) hit += 1;
        }
      }
      // eslint-disable-next-line no-console
      console.log(`ground-truth accuracy: ${hit}/${total}`);
      expect(hit).toBeGreaterThanOrEqual(20);
    },
  );

  // 이번 Phase 1 값-형식 스캐너가 회복한 개별 필드를 고정(핀포인트 회귀 가드).
  (vision && groundTruth ? test : test.skip)(
    'value-format scanners recover product/strictTime/condolence-recipient',
    () => {
      const byImage = new Map(vision!.map((v) => [v.image, v]));
      const val = (img: string, key: string) =>
        parseVision(byImage.get(img)!).fields.find((f) => f.key === key)
          ?.value || '';
      expect(val('KakaoTalk_20260621_070828835_02.jpg', 'productName')).toBe(
        '착한근조',
      );
      expect(val('KakaoTalk_20260621_070828835_03.jpg', 'productName')).toBe(
        '근조 3단',
      );
      expect(val('KakaoTalk_20260621_070828835_04.jpg', 'productName')).toBe(
        '근조화환',
      );
      expect(val('KakaoTalk_20260621_070828835_04.jpg', 'strictTime')).toBe(
        '17:00',
      );
      expect(val('KakaoTalk_20260621_070828835_04.jpg', 'recipientName')).toBe(
        '유기열',
      );
    },
  );
});
