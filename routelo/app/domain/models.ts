export const DOMAIN_SCHEMA_VERSION = 1;
export const DEFAULT_TIMEZONE = 'Asia/Seoul';

export type DeliveryStatus =
  | 'draft'
  | 'reviewRequired'
  | 'pending'
  | 'completed'
  | 'cancelled';

export type SchedulePrecision =
  | 'unknown'
  | 'date-only'
  | 'approximate'
  | 'exact';

export type DeliveryPriority = 'normal' | 'urgent' | 'critical';

export type VendorInfo = {
  name?: string;
  telephone?: string;
};

export type ProductCategory =
  | 'congratulation'
  | 'condolence'
  | 'plant'
  | 'other';

export type ProductInfo = {
  name?: string;
  category?: ProductCategory;
  quantity?: number;
  ribbonText?: string;
};

export type DeliverySchedule = {
  serviceDate?: string;
  timezone: string;
  deliveryWindow?: {
    startAt?: string;
    endAt?: string;
  };
  strictDeadlineAt?: string;
  eventAt?: string;
  plannedArrivalAt?: string;
  actualArrivalAt?: string;
  completedAt?: string;
  timePrecision: SchedulePrecision;
  priority: DeliveryPriority;
};

export type DeliveryDestination = {
  venueName?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
};

export type RecipientInfo = {
  name?: string;
  telephone?: string;
};

export type SettlementInfo = {
  distanceKm?: number;
  fee?: number;
  district?: string;
};

export type DeliveryOrder = {
  schemaVersion: number;
  id: string;
  orderNumber?: string;
  orderingVendor: VendorInfo;
  fulfillingVendor: VendorInfo;
  product: ProductInfo;
  schedule: DeliverySchedule;
  destination: DeliveryDestination;
  recipient: RecipientInfo;
  customerRequests?: string;
  status: DeliveryStatus;
  // 목록에서 숨김(soft-hide). 데이터는 보존하되 홈·배달목록·동선에서 제외한다.
  // 완료된 배송을 시야에서 치우기 위한 사용자 토글. 캘린더/기록에서는 계속 보인다.
  hidden?: boolean;
  settlement: SettlementInfo;
  // Path of the delivery-completion proof photo relative to the app document
  // dir (resolved against the current dir at read time so it survives the
  // container UUID changing across reinstall / backup-restore).
  completionPhotoPath?: string;
  // Path of the scanned receipt (인수증) image, same relative-path scheme.
  // Kept so the calendar/history can show the original receipt per delivery.
  receiptPhotoPath?: string;
  source: {
    type: 'manual' | 'ocr' | 'migration' | 'sample';
    receiptId?: string;
    legacyId?: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type OcrEngine = 'apple-vision' | 'ppocrv5' | 'clova' | 'fixture';

export type OcrPoint = { x: number; y: number };

export type RecognizedLine = {
  id: string;
  text: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  cornerPoints?: OcrPoint[];
  confidence?: number;
};

export type ExtractionStatus =
  | 'missing'
  | 'candidate'
  | 'confirmed'
  | 'rejected';

export type ExtractionMethod = 'label' | 'layout' | 'pattern' | 'manual';

export type ExtractedField<T = string> = {
  value?: T;
  rawValue?: string;
  confidence: number;
  status: ExtractionStatus;
  sourceLineIds: string[];
  extractionMethod?: ExtractionMethod;
  validationErrors: string[];
  alternatives: T[];
};

export type FieldCorrection = {
  fieldKey: string;
  previousValue?: unknown;
  nextValue?: unknown;
  correctedAt: string;
};

export type ReceiptDocument<TFields extends Record<string, unknown> = Record<string, unknown>> = {
  schemaVersion: number;
  id: string;
  imageUri?: string;
  capturedAt: string;
  recognition: {
    engine: OcrEngine;
    processingMs: number;
    fullText: string;
    lines: RecognizedLine[];
  };
  extraction: {
    registryVersion: number;
    fields: TFields;
    unmappedLines: string[];
    documentConfidence: number;
  };
  review: {
    status: 'unreviewed' | 'reviewRequired' | 'approved' | 'rejected';
    reviewedAt?: string;
    corrections: FieldCorrection[];
  };
  linkedDeliveryId?: string;
};

export type RouteStop = {
  deliveryOrderId: string;
  sequence: number;
  plannedArrivalAt?: string;
  estimatedTravelMinutes?: number;
};

export type RoutePlan = {
  schemaVersion: number;
  id: string;
  serviceDate: string;
  timezone: string;
  generatedAt: string;
  stops: RouteStop[];
  totalDistanceKm?: number;
  estimatedDurationMinutes?: number;
};

export type CalendarDeliveryItem = {
  id: string;
  deliveryOrderId: string;
  date: string;
  startAt?: string;
  endAt?: string;
  deadlineAt?: string;
  eventAt?: string;
  plannedArrivalAt?: string;
  title: string;
  address: string;
  status: DeliveryStatus;
  priority: DeliveryPriority;
  timePrecision: SchedulePrecision;
  routeSequence?: number;
};
