/// <reference types="node" />

import fs from 'fs';
import path from 'path';

import { inspectCaptureQuality, parseReceiptText } from '../ocr';

type NativeResult = {
  file: string;
  sha256: string;
  width: number;
  height: number;
  processingMs: number;
  fullText: string;
  lineCount: number;
};

type NativeReport = {
  schemaVersion: number;
  engine: string;
  device: {
    manufacturer: string;
    model: string;
    apiLevel: number;
    release: string;
  };
  sourceDirectory: string;
  results: NativeResult[];
};

const benchmarkDirectory = path.resolve(
  __dirname,
  '../../../docs/ocr-benchmark/2026-06-23',
);
const nativeReportPath = path.join(benchmarkDirectory, 'native-results.json');
const parsedReportPath = path.join(benchmarkDirectory, 'parsed-results.json');

const demoMarkers = [
  'FL-20260621-1842',
  '010-4821-7732',
  '선릉로 757',
  '더채플앳청담',
];

const compact = (value: string) =>
  value.normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');

const digits = (value: string) => value.replace(/\D/g, '');

describe('repository receipt dataset benchmark', () => {
  it('parses the recorded OCR baseline without injecting unsupported values', () => {
    const nativeReport = JSON.parse(
      fs.readFileSync(nativeReportPath, 'utf8'),
    ) as NativeReport;

    const results = nativeReport.results.map((native) => {
      const quality = inspectCaptureQuality({
        width: native.width,
        height: native.height,
      });
      const parsed = parseReceiptText(native.fullText, quality);
      const compactRaw = compact(native.fullText);
      const firstLineDigits = digits(native.fullText.split(/\r?\n/)[0] || '');
      const fields = parsed.fields.map((field) => {
        const compactValue = compact(field.value);
        const compactSource = compact(field.sourceText);
        const provenance = !field.value
          ? 'missing'
          : field.sourceText && compactRaw.includes(compactSource)
            ? 'sourceText'
            : compactValue && compactRaw.includes(compactValue)
              ? 'rawFallback'
              : 'unsupported';
        const semanticRisks: Array<{
          severity: 'false-data' | 'review';
          reason: string;
        }> = [];
        if (field.key === 'recipientTel' && field.value) {
          if (!/^(?:01[016789]-\d{3,4}-\d{4}|02-\d{3,4}-\d{4}|0\d{2}-\d{3,4}-\d{4})$/.test(field.value)) {
            semanticRisks.push({
              severity: 'false-data',
              reason: 'recipientTel is populated with a non-phone value',
            });
          } else if (
            !field.sourceText &&
            firstLineDigits.includes(digits(field.value))
          ) {
            semanticRisks.push({
              severity: 'false-data',
              reason: 'digits from the order identifier were normalized as recipientTel',
            });
          } else if (!field.sourceText) {
            semanticRisks.push({
              severity: 'review',
              reason: 'unlabelled phone fallback cannot prove that the number belongs to the recipient',
            });
          }
        }
        if (
          field.key === 'recipientName' &&
          field.value &&
          /플라워|반드시|이름|분시/.test(field.value)
        ) {
          semanticRisks.push({
            severity: 'false-data',
            reason: 'layout-shift assigned a vendor or form instruction as recipientName',
          });
        }
        if (
          field.key === 'memo' &&
          field.value &&
          /010-\d{3,4}-?$/.test(field.value)
        ) {
          semanticRisks.push({
            severity: 'false-data',
            reason: 'vendor/contact line was assigned as memo',
          });
        }
        return {
          key: field.key,
          value: field.value,
          confidence: field.confidence,
          status: field.status,
          sourceText: field.sourceText,
          provenance,
          semanticRisks,
        };
      });
      const serializedFields = JSON.stringify(fields);
      const leakedDemoMarkers = demoMarkers.filter(
        (marker) =>
          native.fullText.includes(marker) || serializedFields.includes(marker),
      );

      return {
        file: native.file,
        sha256: native.sha256,
        image: {
          width: native.width,
          height: native.height,
        },
        native: {
          processingMs: native.processingMs,
          lineCount: native.lineCount,
          characterCount: native.fullText.length,
          nonEmpty: native.fullText.trim().length > 0,
        },
        parser: {
          documentConfidence: parsed.documentConfidence,
          populatedFieldCount: fields.filter((field) => field.value).length,
          unsupportedFieldCount: fields.filter(
            (field) => field.provenance === 'unsupported',
          ).length,
          falseDataRiskCount: fields.reduce(
            (sum, field) =>
              sum +
              field.semanticRisks.filter(
                (risk) => risk.severity === 'false-data',
              ).length,
            0,
          ),
          reviewRiskCount: fields.reduce(
            (sum, field) =>
              sum +
              field.semanticRisks.filter(
                (risk) => risk.severity === 'review',
              ).length,
            0,
          ),
          rawFallbackFieldCount: fields.filter(
            (field) => field.provenance === 'rawFallback',
          ).length,
          unmappedLineCount: parsed.unmapped.length,
          fields,
        },
        antiFabrication: {
          leakedDemoMarkers,
          passed:
            leakedDemoMarkers.length === 0 &&
            fields.every((field) => field.provenance !== 'unsupported'),
        },
      };
    });

    const report = {
      schemaVersion: 1,
      generatedAt: '2026-06-23',
      nativeEngine: nativeReport.engine,
      device: nativeReport.device,
      parser: 'app/services/ocr.ts::parseReceiptText',
      demoMarkersChecked: demoMarkers,
      summary: {
        imageCount: results.length,
        nativeNonEmptyCount: results.filter(
          (result) => result.native.nonEmpty,
        ).length,
        antiFabricationPassCount: results.filter(
          (result) => result.antiFabrication.passed,
        ).length,
        demoLeakCount: results.reduce(
          (sum, result) =>
            sum + result.antiFabrication.leakedDemoMarkers.length,
          0,
        ),
        unsupportedFieldCount: results.reduce(
          (sum, result) => sum + result.parser.unsupportedFieldCount,
          0,
        ),
        falseDataRiskCount: results.reduce(
          (sum, result) => sum + result.parser.falseDataRiskCount,
          0,
        ),
        reviewRiskCount: results.reduce(
          (sum, result) => sum + result.parser.reviewRiskCount,
          0,
        ),
      },
      results,
    };

    fs.writeFileSync(parsedReportPath, `${JSON.stringify(report, null, 2)}\n`);

    expect(results).toHaveLength(8);
    expect(report.summary.nativeNonEmptyCount).toBe(8);
    expect(report.summary.demoLeakCount).toBe(0);
    expect(report.summary.unsupportedFieldCount).toBe(0);
  });
});
