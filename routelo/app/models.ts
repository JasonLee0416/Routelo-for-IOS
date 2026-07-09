import type { LegacyDelivery } from './domain';

export type DeliveryStatus = 'pending' | 'completed';

// Compatibility shape for existing screens. Canonical persistence uses
// DeliveryOrder from app/domain and is converted through explicit adapters.
export type Delivery = LegacyDelivery;

export type FeeSettings = {
  districtFees: Record<string, number>;
  fuelEfficiency: number;
  themeMode: 'light' | 'dark';
  vehicleModel: string;
  fuelTankCapacity: number;
};

export type FuelLog = {
  id: string;
  date: string;
  pricePerLiter: number;
  liters: number;
  amount: number;
  odometerKm: number;
};

export type MileageLog = {
  id: string;
  date: string;
  odometerKm: number;
  dailyDistanceKm: number;
};

export type ContactChannel =
  | 'recipient'
  | 'orderingVendor'
  | 'fulfillingVendor'
  | 'other';

// A record that the driver placed a call for a delivery, so the history is
// available for re-contact and dispute handling.
export type ContactLog = {
  id: string;
  deliveryId: string;
  channel: ContactChannel;
  label: string; // display label captured at call time (수령인/발주처/화원)
  phone: string;
  at: string; // ISO timestamp
};

export type OcrForm = {
  orderVendor: string;
  orderVendorTel: string;
  deliveryVendor: string;
  deliveryVendorTel: string;
  productName: string;
  productQuantity: string;
  eventTime: string;
  deliveryDt: string;
  deliveryAddress: string;
  customerRequests: string;
  recipientTel: string;
};

export type OcrFieldKey =
  | 'orderingVendorName'
  | 'orderingVendorTel'
  | 'fulfillingVendorName'
  | 'fulfillingVendorTel'
  | 'productName'
  | 'productQuantity'
  | 'ribbonText'
  | 'deliveryDate'
  | 'deliveryWindowStart'
  | 'deliveryWindowEnd'
  | 'strictTime'
  | 'eventTime'
  | 'venueName'
  | 'deliveryAddress'
  | 'recipientName'
  | 'recipientTel'
  | 'memo';

export type OcrFieldResult = {
  key: OcrFieldKey;
  label: string;
  value: string;
  rawValue?: string;
  confidence: number;
  required: boolean;
  sourceText: string;
  sourceLineIds?: string[];
  extractionMethod?: 'label' | 'layout' | 'pattern' | 'manual';
  validationErrors?: string[];
  alternatives: string[];
  status: 'confirmed' | 'review' | 'warning' | 'missing';
};

export type CaptureQuality = {
  score: number;
  blur: number;
  brightness: number;
  documentCoverage: number;
  skew: number;
  shadow: number;
  passed: boolean;
  messages: string[];
};

export type OcrPipelineResult = {
  engine: 'apple-vision' | 'ppocrv5' | 'clova' | 'fixture';
  modelVersion?: string;
  rawText: string;
  recognizedLines?: Array<{
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
  fields: OcrFieldResult[];
  documentConfidence: number;
  quality: CaptureQuality;
  processingMs: number;
  variantsCompared: number;
  // 어떤 필드에도 매핑되지 않은 줄(라벨/값). 버리지 않고 보존한다(무손실).
  unmapped: { label: string; value: string }[];
  // 시간 필드 간 논리 충돌(검수 UI 강조용). 없으면 빈 배열.
  conflicts: { keys: OcrFieldKey[]; message: string }[];
  // CLOVA 2차 보정 제안(자동 실행 아님, 사용자 동의 필요). 트리거 조건 미충족 시 trigger=false.
  cloudFallback: { trigger: boolean; reasons: string[] };
};
