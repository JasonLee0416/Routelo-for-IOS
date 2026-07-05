import {
  CaptureQuality,
  OcrFieldKey,
  OcrFieldResult,
  OcrPipelineResult,
} from '../models';
import { shouldRequestCloudFallback } from '../ocr/cloudFallback';
import { inferEventType } from '../ocr/contentClassifier';
import {
  cleanVendorName,
  extractPersonName,
  pickBest,
  scoreAddress,
} from '../ocr/fieldHeuristics';
import {
  KOREAN_PHONE_PATTERN,
  detectFieldConflicts,
  isValidKoreanPhone,
  matchKoreanDate,
  normalizeKoreanPhone,
  normalizeKoreanTime,
} from '../ocr/fieldValidation';
import { DEFAULT_FIELD_REGISTRY } from '../ocr/fieldRegistry';
import { buildLayoutText } from '../ocr/layout';
import { normalizeReceipt } from '../ocr/normalize';

type ImageAssetInfo = {
  uri?: string;
  width?: number;
  height?: number;
  fileSize?: number;
};

type RecognizedText = {
  engine?: 'apple-vision' | 'ppocrv5' | 'clova';
  modelVersion?: string;
  fullText: string;
  processingMs: number;
  lines?: Array<{
    text: string;
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    cornerPoints?: Array<{ x: number; y: number }>;
    confidence?: number;
  }>;
};

type RecognizeImage = (imageUri: string) => Promise<RecognizedText>;

export class OcrRecognizerUnavailableError extends Error {
  constructor(
    message = '실제 OCR 인식 엔진을 사용할 수 없습니다. 촬영한 사진에서 임의의 정보를 생성하지 않습니다.',
  ) {
    super(message);
    this.name = 'OcrRecognizerUnavailableError';
  }
}

export class OcrNoTextDetectedError extends Error {
  constructor() {
    super(
      '사진에서 인식 가능한 글자를 찾지 못했습니다. 인수증 전체가 선명하게 보이도록 다시 촬영해 주세요.',
    );
    this.name = 'OcrNoTextDetectedError';
  }
}

const LABELS: Record<OcrFieldKey, string> = {
  orderingVendorName: '발주화원',
  orderingVendorTel: '발주화원 전화번호',
  fulfillingVendorName: '배송화원',
  fulfillingVendorTel: '배송화원 전화번호',
  productName: '상품명',
  productQuantity: '수량',
  ribbonText: '리본 문구',
  deliveryDate: '배송 날짜',
  deliveryWindowStart: '배송 시작 시간',
  deliveryWindowEnd: '배송 종료 시간',
  strictTime: '배달 엄수 시간',
  eventTime: '예식 시간',
  venueName: '상호명 / 예식장명',
  deliveryAddress: '배송 주소',
  recipientName: '수령자 / 담당자',
  recipientTel: '수령인 연락처',
  memo: '특이사항 / 메모',
};

const REQUIRED = new Set<OcrFieldKey>([
  'deliveryDate',
  'productName',
  'deliveryAddress',
]);

// 전화/시각/날짜 값 검증은 공용 도메인 모듈(app/ocr/fieldValidation)로 위임한다.
// 070(VoIP)·1566 대표번호·한글 날짜(2026년 06월 14일)까지 강화된 규칙을 공유한다.
const PHONE_PATTERN = KOREAN_PHONE_PATTERN;
const normalizeTime = normalizeKoreanTime;
const normalizePhone = normalizeKoreanPhone;

const allMatches = (text: string, pattern: RegExp) =>
  [...text.matchAll(pattern)].map((match) => match[0]);

function field(
  key: OcrFieldKey,
  value: string,
  confidence: number,
  sourceText: string,
  alternatives: string[] = [],
  options: {
    sourceLineIds?: string[];
    extractionMethod?: OcrFieldResult['extractionMethod'];
    validationErrors?: string[];
    forceReview?: boolean;
  } = {},
): OcrFieldResult {
  const validationErrors = options.validationErrors || [];
  const status: OcrFieldResult['status'] = !value
    ? 'missing'
    : validationErrors.length
      ? 'warning'
      : options.forceReview
        ? 'review'
        : confidence >= 85
          ? 'confirmed'
          : confidence >= 60
            ? 'review'
            : 'warning';
  return {
    key,
    label: LABELS[key],
    value,
    rawValue: sourceText || undefined,
    confidence: value ? confidence : 0,
    required: REQUIRED.has(key),
    sourceText,
    sourceLineIds: options.sourceLineIds,
    extractionMethod: options.extractionMethod,
    validationErrors,
    alternatives,
    status,
  };
}

const compactLabel = (value: string) =>
  value.replace(/[\s:：|[\]()]/g, '').toLowerCase();

const lineId = (index: number) => `line-${index + 1}`;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findLabeledValue(lines: string[], aliases: string[]) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const alias of [...aliases].sort(
      (left, right) => right.length - left.length,
    )) {
      if (!compactLabel(line).startsWith(compactLabel(alias))) continue;
      const value = line
        .replace(
          new RegExp(`^\\s*${escapeRegExp(alias)}\\s*[:：|]?\\s*`, 'i'),
          '',
        )
        .trim();
      if (
        !value ||
        value === line.trim() ||
        compactLabel(value) === compactLabel(alias)
      ) {
        continue;
      }
      return {
        value,
        sourceText: line,
        sourceLineIds: [lineId(index)],
      };
    }
  }
  return undefined;
}

function firstMatchingLine(
  lines: string[],
  predicate: (line: string) => boolean,
) {
  const index = lines.findIndex(predicate);
  if (index < 0) return undefined;
  return {
    value: lines[index],
    sourceText: lines[index],
    sourceLineIds: [lineId(index)],
  };
}

// 한 값에 전화가 여러 개면 휴대폰(01x) > VoIP(070) > 기타 순으로 고른다
// (팩스/대표번호가 담당자 연락처로 잘못 뽑히는 것 방지).
function pickBestPhone(raw: string): string | undefined {
  const phones = allMatches(raw, PHONE_PATTERN)
    .map(normalizePhone)
    .filter((phone) => isValidKoreanPhone(phone));
  return (
    phones.find((p) => p.startsWith('01')) ||
    phones.find((p) => p.startsWith('070')) ||
    phones[0]
  );
}

function validatedPhoneCandidate(
  candidate: ReturnType<typeof findLabeledValue>,
) {
  if (!candidate) return undefined;
  const value = pickBestPhone(candidate.value);
  return value ? { ...candidate, value } : undefined;
}

function normalizeQuantity(value: string) {
  const explicit = value.match(/수량\s*[|:]?\s*(\d{1,2})/);
  const count = explicit || value.match(/(\d{1,2})\s*개/);
  const quantity = count ? Number(count[1]) : NaN;
  return Number.isInteger(quantity) && quantity > 0 && quantity <= 99
    ? String(quantity)
    : '';
}

export function inspectCaptureQuality(asset: ImageAssetInfo): CaptureQuality {
  const width = asset.width || 1200;
  const height = asset.height || 1600;
  const pixels = width * height;
  const coverage = Math.min(
    98,
    Math.max(52, (Math.min(width, height) / Math.max(width, height)) * 145),
  );
  const resolutionScore = Math.min(100, pixels / 18000);
  const blur = Math.round(Math.min(96, 62 + resolutionScore * 0.34));
  const brightness = 82;
  const skew = 93;
  const shadow = 87;
  const score = Math.round(
    (blur + brightness + coverage + skew + shadow) / 5,
  );
  const messages: string[] = [];
  if (blur < 65) messages.push('사진이 흔들렸습니다. 다시 촬영해주세요.');
  if (brightness < 60) {
    messages.push('인수증이 너무 어둡습니다. 밝은 곳에서 촬영해주세요.');
  }
  if (coverage < 60) {
    messages.push('인수증 전체가 화면에 들어오도록 맞춰주세요.');
  }
  if (pixels < 900000) {
    messages.push('글자가 너무 작습니다. 조금 더 가까이 촬영해주세요.');
  }
  return {
    score,
    blur,
    brightness,
    documentCoverage: Math.round(coverage),
    skew,
    shadow,
    passed: score >= 65 && messages.length === 0,
    messages,
  };
}

export function parseReceiptText(
  rawText: string,
  quality: CaptureQuality,
): OcrPipelineResult {
  const started = Date.now();
  const text = rawText.replace(/[ \t]+/g, ' ').trim();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const { fields: mapped, unmapped } = normalizeReceipt(
    lines,
    DEFAULT_FIELD_REGISTRY,
  );

  const orderingVendor = findLabeledValue(lines, [
    '발주화원',
    '발주처',
    '발주회원',
  ]);
  const fulfillingVendor = findLabeledValue(lines, [
    '배송화원',
    '수주화원',
    '수주회원',
  ]);
  // 업체명에서 전화·라벨 잔여 제거(주소면 상호 아님 → '').
  const orderingVendorName = cleanVendorName(orderingVendor?.value || '');
  const fulfillingVendorName = cleanVendorName(fulfillingVendor?.value || '');
  // 라벨 전화가 없으면 업체명 줄 자체에서 전화를 페어링(업체↔전화 쌍).
  const vendorPhoneFromLine = (src: ReturnType<typeof findLabeledValue>) => {
    if (!src) return undefined;
    const phone = pickBestPhone(src.sourceText);
    return phone
      ? { value: phone, sourceText: src.sourceText, sourceLineIds: src.sourceLineIds }
      : undefined;
  };
  const orderingVendorTel =
    validatedPhoneCandidate(
      findLabeledValue(lines, ['발주화원 전화', '발주처 전화', '발주 전화']),
    ) || vendorPhoneFromLine(orderingVendor);
  const fulfillingVendorTel =
    validatedPhoneCandidate(
      findLabeledValue(lines, ['배송화원 전화', '수주화원 전화', '배송 전화']),
    ) || vendorPhoneFromLine(fulfillingVendor);

  const productSource =
    findLabeledValue(lines, ['상품명', '배송상품', '품명', '상품']) ||
    firstMatchingLine(lines, (line) =>
      /(?:축하|근조).*(?:화환|3단)|화환.*(?:축하|근조|3단)/.test(line),
    );
  const quantitySource =
    findLabeledValue(lines, ['수량', '개수', '갯수']) ||
    (productSource && /\d+\s*개/.test(productSource.value)
      ? productSource
      : undefined);
  // 상품명은 뒤에 붙은 수량("... 2개")을 떼어 순수 품목만 남긴다(수량은 별도 필드).
  const productName = (productSource?.value || '')
    .replace(/\s*\d+\s*개\s*$/, '')
    .trim();
  const ribbonSource =
    findLabeledValue(lines, [
      '리본문구',
      '리본 문구',
      '리본메세지',
      '리본메시지',
      '경조사어',
    ]) ||
    firstMatchingLine(lines, (line) =>
      /삼가.*(?:명복|조의)|축하.*(?:결혼|개업)|부활/.test(line),
    );

  // 연도 없는 날짜("06월 14일")도 회복: 텍스트의 20YY를 우선, 없으면 현재 연도로 보정.
  const inferredYear =
    Number((text.match(/20\d{2}/) || [])[0]) || new Date().getFullYear();
  const dateMatch = matchKoreanDate(mapped.deliveryDate || text, inferredYear);
  const deliveryDate = dateMatch?.value || '';
  // 재포맷된 날짜의 출처를 원본 매칭 문자열로 남겨 provenance 추적을 유지한다.
  const deliveryDateSource = dateMatch?.raw || mapped.deliveryDate || '';
  const range = text.match(
    /(\d{1,2}:\d{2})\s*[~～\-]\s*(\d{1,2})\s*:?\s*(\d{2})/,
  );
  const deliveryWindowStart = range ? normalizeTime(range[1]) : '';
  const deliveryWindowEnd = range
    ? normalizeTime(`${range[2]}:${range[3]}`)
    : '';

  const strictSource = findLabeledValue(lines, [
    '시간엄수',
    '엄수시간',
    '배달 엄수',
    '까지 배송',
  ]);
  const eventSource =
    findLabeledValue(lines, ['예식 시간', '예식시간', '예식', '본식', '행사시간']) ||
    firstMatchingLine(lines, (line) =>
      /\(\s*\d{1,2}시\s*\d{0,2}분?\s*식\s*\)/.test(line),
    );
  const strictTime = strictSource
    ? normalizeTime(strictSource.value)
    : '';
  const eventTime = eventSource ? normalizeTime(eventSource.value) : '';

  const venueSource = findLabeledValue(lines, [
    '업체명',
    '상호명',
    '예식장',
    '웨딩홀',
    '배송처',
  ]);
  // 라벨 매칭 실패 시, 한국 주소다움 점수가 가장 높은 줄을 폴백으로 선택(앵커-값 재랭킹).
  const addressFallback = (() => {
    const best = pickBest(lines, scoreAddress);
    if (!best) return undefined;
    return {
      value: best,
      sourceText: best,
      sourceLineIds: [lineId(lines.indexOf(best))],
    };
  })();
  const addressSource =
    findLabeledValue(lines, ['배송주소', '배달주소', '배송지', '배달장소', '주소']) ||
    addressFallback;
  const recipientSource = findLabeledValue(lines, [
    '받는분',
    '받는 분',
    '수령인',
    '인수자',
  ]);
  // 업체/주소/지시문이 수령자로 오배정되는 것을 막는다(vendor vs recipient disambiguation).
  // 폴백: 라벨 행이 다른 셀과 병합돼 startsWith 매칭이 실패해도, "받는분 [존칭] 이름" 패턴을
  // 병합된 텍스트에서 직접 뽑는다(Vision은 이 조각을 깨끗이 인식하나 레이아웃이 뭉침).
  const recipientFromLabel = extractPersonName(recipientSource?.value || '');
  const recipientFromScan = (() => {
    if (recipientFromLabel) return '';
    const m = text.match(
      /(?:받는\s*분|받으실분|수령인|인수자)\s*[:：]?\s*((?:고인?|故|상주|신랑|신부)?\s*[가-힣]{2,4})/,
    );
    return m ? extractPersonName(m[1]) : '';
  })();
  const recipientName = recipientFromLabel || recipientFromScan;
  const recipientTelSource = validatedPhoneCandidate(
    findLabeledValue(lines, [
      '수령인 전화',
      '인수자 전화',
      '받는분 전화',
      '받는 분 전화',
      '수령자 연락처',
      '인수자 연락처',
      '핸드폰',
    ]),
  );
  const phoneAlternatives = allMatches(text, PHONE_PATTERN)
    .map(normalizePhone)
    .filter((phone) => isValidKoreanPhone(phone));
  const memoSource = findLabeledValue(lines, [
    '요청사항',
    '요구사항',
    '특이사항',
    '메모',
    '주의',
    '비고',
  ]);
  const memo =
    memoSource && !allMatches(memoSource.value, PHONE_PATTERN).length
      ? memoSource.value
      : '';

  const fields: OcrFieldResult[] = [
    field(
      'orderingVendorName',
      orderingVendorName,
      orderingVendorName ? 78 : 0,
      orderingVendor?.sourceText || '',
      [],
      {
        sourceLineIds: orderingVendor?.sourceLineIds,
        extractionMethod: orderingVendorName ? 'label' : undefined,
        forceReview: true,
      },
    ),
    field(
      'orderingVendorTel',
      orderingVendorTel?.value || '',
      orderingVendorTel ? 90 : 0,
      orderingVendorTel?.sourceText || '',
      [],
      {
        sourceLineIds: orderingVendorTel?.sourceLineIds,
        extractionMethod: orderingVendorTel ? 'label' : undefined,
      },
    ),
    field(
      'fulfillingVendorName',
      fulfillingVendorName,
      fulfillingVendorName ? 78 : 0,
      fulfillingVendor?.sourceText || '',
      [],
      {
        sourceLineIds: fulfillingVendor?.sourceLineIds,
        extractionMethod: fulfillingVendorName ? 'label' : undefined,
        forceReview: true,
      },
    ),
    field(
      'fulfillingVendorTel',
      fulfillingVendorTel?.value || '',
      fulfillingVendorTel ? 90 : 0,
      fulfillingVendorTel?.sourceText || '',
      [],
      {
        sourceLineIds: fulfillingVendorTel?.sourceLineIds,
        extractionMethod: fulfillingVendorTel ? 'label' : undefined,
      },
    ),
    field(
      'productName',
      productName,
      productName ? 82 : 0,
      productSource?.sourceText || '',
      [],
      {
        sourceLineIds: productSource?.sourceLineIds,
        extractionMethod: productName ? 'pattern' : undefined,
        forceReview: true,
      },
    ),
    field(
      'productQuantity',
      normalizeQuantity(quantitySource?.value || ''),
      quantitySource ? 78 : 0,
      quantitySource?.sourceText || '',
      [],
      {
        sourceLineIds: quantitySource?.sourceLineIds,
        extractionMethod: quantitySource ? 'pattern' : undefined,
        forceReview: true,
      },
    ),
    field(
      'ribbonText',
      ribbonSource?.value || '',
      ribbonSource ? 76 : 0,
      ribbonSource?.sourceText || '',
      [],
      {
        sourceLineIds: ribbonSource?.sourceLineIds,
        extractionMethod: ribbonSource ? 'pattern' : undefined,
        forceReview: true,
      },
    ),
    field(
      'deliveryDate',
      deliveryDate,
      deliveryDate ? 92 : 0,
      deliveryDateSource,
      [],
      {
        extractionMethod: deliveryDate ? 'pattern' : undefined,
        forceReview: !mapped.deliveryDate,
      },
    ),
    field(
      'deliveryWindowStart',
      deliveryWindowStart,
      deliveryWindowStart ? 88 : 0,
      range?.[0] || '',
      [],
      {
        extractionMethod: deliveryWindowStart ? 'pattern' : undefined,
        forceReview: true,
      },
    ),
    field(
      'deliveryWindowEnd',
      deliveryWindowEnd,
      deliveryWindowEnd ? 88 : 0,
      range?.[0] || '',
      [],
      {
        extractionMethod: deliveryWindowEnd ? 'pattern' : undefined,
        forceReview: true,
      },
    ),
    field(
      'strictTime',
      strictTime,
      strictTime ? 86 : 0,
      strictSource?.sourceText || '',
      [],
      {
        sourceLineIds: strictSource?.sourceLineIds,
        extractionMethod: strictTime ? 'label' : undefined,
        forceReview: true,
      },
    ),
    field(
      'eventTime',
      eventTime,
      eventTime ? 86 : 0,
      eventSource?.sourceText || '',
      [],
      {
        sourceLineIds: eventSource?.sourceLineIds,
        extractionMethod: eventTime ? 'label' : undefined,
        forceReview: true,
      },
    ),
    field(
      'venueName',
      venueSource?.value || '',
      venueSource ? 80 : 0,
      venueSource?.sourceText || '',
      [],
      {
        sourceLineIds: venueSource?.sourceLineIds,
        extractionMethod: venueSource ? 'label' : undefined,
        forceReview: true,
      },
    ),
    field(
      'deliveryAddress',
      addressSource?.value || '',
      addressSource ? 84 : 0,
      addressSource?.sourceText || '',
      [],
      {
        sourceLineIds: addressSource?.sourceLineIds,
        extractionMethod: addressSource ? 'pattern' : undefined,
        forceReview: true,
      },
    ),
    field(
      'recipientName',
      recipientName,
      recipientName ? 82 : 0,
      recipientSource?.sourceText || '',
      [],
      {
        sourceLineIds: recipientSource?.sourceLineIds,
        extractionMethod: recipientName ? 'label' : undefined,
        forceReview: true,
      },
    ),
    field(
      'recipientTel',
      recipientTelSource?.value || '',
      recipientTelSource ? 90 : 0,
      recipientTelSource?.sourceText || '',
      phoneAlternatives,
      {
        sourceLineIds: recipientTelSource?.sourceLineIds,
        extractionMethod: recipientTelSource ? 'label' : undefined,
        forceReview: true,
      },
    ),
    field(
      'memo',
      memo,
      memo ? 78 : 0,
      memoSource?.sourceText || '',
      [],
      {
        sourceLineIds: memoSource?.sourceLineIds,
        extractionMethod: memo ? 'label' : undefined,
        forceReview: true,
      },
    ),
  ];

  const requiredFields = fields.filter((item) => item.required);
  const documentConfidence = Math.round(
    requiredFields.reduce((sum, item) => sum + item.confidence, 0) /
      Math.max(requiredFields.length, 1),
  );

  // 시간 필드 간 논리 충돌 + CLOVA 2차 보정 제안(자동 실행 아님).
  const fieldValues: Partial<Record<OcrFieldKey, string>> = {};
  for (const item of fields) {
    if (item.value) fieldValues[item.key] = item.value;
  }
  const conflicts = detectFieldConflicts(fieldValues);
  const cloudFallback = shouldRequestCloudFallback({
    fields,
    documentConfidence,
    conflicts,
  });
  // 값 형식으로 경조사 종류 추론(축하/근조) — 레이아웃 무관, 상품·리본 교차검증 기반.
  const eventInference = inferEventType(text);
  const eventType = {
    type: eventInference.type,
    confidence: eventInference.confidence,
  };

  return {
    engine: 'fixture',
    rawText: text,
    fields,
    documentConfidence,
    quality,
    processingMs: Date.now() - started,
    variantsCompared: 1,
    unmapped,
    conflicts,
    cloudFallback,
    eventType,
  };
}

export async function runReceiptOcr(
  asset: ImageAssetInfo,
  rawText?: string,
  recognizeImage?: RecognizeImage,
): Promise<OcrPipelineResult> {
  const quality = inspectCaptureQuality(asset);
  if (rawText?.trim()) {
    return parseReceiptText(rawText, quality);
  }
  if (!asset.uri?.trim()) {
    throw new OcrRecognizerUnavailableError('촬영한 인수증 이미지가 없습니다.');
  }

  try {
    const recognize =
      recognizeImage ||
      (async (imageUri: string) => {
        const { recognizeReceiptWithPpOcr } = await import('./recognizer');
        return recognizeReceiptWithPpOcr(imageUri);
      });
    const recognized = await recognize(asset.uri);
    if (!recognized.fullText.trim()) throw new OcrNoTextDetectedError();
    const layoutText = buildLayoutText(
      recognized.lines || [],
      recognized.fullText,
    );
    const parsed = parseReceiptText(layoutText, quality);
    return {
      ...parsed,
      engine: recognized.engine || 'ppocrv5',
      modelVersion: recognized.modelVersion,
      recognizedLines: recognized.lines,
      processingMs: recognized.processingMs,
    };
  } catch (error) {
    if (error instanceof OcrNoTextDetectedError) throw error;
    throw new OcrRecognizerUnavailableError(
      error instanceof Error
        ? `PP-OCR 실행에 실패했습니다: ${error.message}`
        : undefined,
    );
  }
}
