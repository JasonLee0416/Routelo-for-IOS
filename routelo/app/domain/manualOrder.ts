import {
  DEFAULT_TIMEZONE,
  DeliveryOrder,
  DeliveryPriority,
  DeliverySchedule,
  DOMAIN_SCHEMA_VERSION,
  ProductCategory,
} from './models';

// User-facing flat input for creating or editing a delivery by hand (no OCR).
export type ManualOrderInput = {
  productName: string;
  productQuantity?: number;
  orderingVendorName?: string;
  orderingVendorTel?: string;
  fulfillingVendorName?: string;
  fulfillingVendorTel?: string;
  serviceDate?: string; // YYYY-MM-DD
  strictTime?: string; // HH:mm
  eventTime?: string; // HH:mm
  venueName?: string;
  deliveryAddress?: string;
  recipientName?: string;
  recipientTel?: string;
  customerRequests?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export function validateManualOrderInput(input: ManualOrderInput): string[] {
  const errors: string[] = [];
  if (!input.productName || !input.productName.trim()) {
    errors.push('상품명을 입력해주세요.');
  }
  if (input.serviceDate && !DATE_RE.test(input.serviceDate)) {
    errors.push('배송 날짜 형식은 YYYY-MM-DD 입니다.');
  }
  if (input.strictTime && !TIME_RE.test(input.strictTime)) {
    errors.push('엄수 시간 형식은 HH:mm 입니다.');
  }
  if (input.eventTime && !TIME_RE.test(input.eventTime)) {
    errors.push('예식 시간 형식은 HH:mm 입니다.');
  }
  if (input.strictTime && !input.serviceDate) {
    errors.push('엄수 시간을 쓰려면 배송 날짜가 필요합니다.');
  }
  if (input.eventTime && !input.serviceDate) {
    errors.push('예식 시간을 쓰려면 배송 날짜가 필요합니다.');
  }
  if (
    input.productQuantity !== undefined &&
    (!Number.isInteger(input.productQuantity) || input.productQuantity < 0)
  ) {
    errors.push('수량은 0 이상의 정수여야 합니다.');
  }
  return errors;
}

const clean = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const classifyProduct = (name?: string): ProductCategory | undefined => {
  if (!name) return undefined;
  if (/축하|웨딩/.test(name)) return 'congratulation';
  if (/근조|장례/.test(name)) return 'condolence';
  if (/화분|관엽|난/.test(name)) return 'plant';
  return 'other';
};

const isoAt = (date?: string, time?: string) =>
  date && time && DATE_RE.test(date) && TIME_RE.test(time)
    ? `${date}T${time}:00+09:00`
    : undefined;

function buildSchedule(input: ManualOrderInput): DeliverySchedule {
  const serviceDate = clean(input.serviceDate);
  const strictDeadlineAt = isoAt(serviceDate, clean(input.strictTime));
  const eventAt = isoAt(serviceDate, clean(input.eventTime));
  const priority: DeliveryPriority = eventAt ? 'critical' : 'normal';
  return {
    serviceDate,
    timezone: DEFAULT_TIMEZONE,
    strictDeadlineAt,
    eventAt,
    timePrecision: strictDeadlineAt
      ? 'exact'
      : serviceDate
        ? 'date-only'
        : 'unknown',
    priority,
  };
}

type OrderCore = Pick<
  DeliveryOrder,
  | 'orderingVendor'
  | 'fulfillingVendor'
  | 'product'
  | 'schedule'
  | 'destination'
  | 'recipient'
  | 'customerRequests'
>;

function buildCore(input: ManualOrderInput): OrderCore {
  const name = clean(input.productName);
  const quantity = input.productQuantity;
  return {
    orderingVendor: {
      name: clean(input.orderingVendorName),
      telephone: clean(input.orderingVendorTel),
    },
    fulfillingVendor: {
      name: clean(input.fulfillingVendorName),
      telephone: clean(input.fulfillingVendorTel),
    },
    product: {
      name,
      category: classifyProduct(name),
      quantity:
        quantity !== undefined && Number.isInteger(quantity) && quantity > 0
          ? quantity
          : undefined,
    },
    schedule: buildSchedule(input),
    destination: {
      venueName: clean(input.venueName),
      address: clean(input.deliveryAddress),
    },
    recipient: {
      name: clean(input.recipientName),
      telephone: clean(input.recipientTel),
    },
    customerRequests: clean(input.customerRequests),
  };
}

// Builds a canonical DeliveryOrder from a manual form. Unlike the legacy
// adapter, this always tags source.type = 'manual' (the legacy adapter would
// mis-tag a `delivery-*` id as 'sample'). `id` and `now` are injected so the
// function stays pure and testable.
export function createManualDeliveryOrder(
  input: ManualOrderInput,
  opts: { id: string; now: string },
): DeliveryOrder {
  const errors = validateManualOrderInput(input);
  if (errors.length) throw new Error(errors.join(' '));
  return {
    schemaVersion: DOMAIN_SCHEMA_VERSION,
    id: opts.id,
    ...buildCore(input),
    status: 'pending',
    settlement: {},
    source: { type: 'manual' },
    createdAt: opts.now,
    updatedAt: opts.now,
  };
}

// Flattens a canonical order back into the manual form shape, so the edit form
// can be pre-filled. Inverse of createManualDeliveryOrder for the form fields.
export function orderToManualInput(order: DeliveryOrder): ManualOrderInput {
  const strictTime = order.schedule.strictDeadlineAt?.match(/T(\d{2}:\d{2})/)?.[1];
  const eventTime = order.schedule.eventAt?.match(/T(\d{2}:\d{2})/)?.[1];
  return {
    productName: order.product.name ?? '',
    productQuantity: order.product.quantity,
    orderingVendorName: order.orderingVendor.name,
    orderingVendorTel: order.orderingVendor.telephone,
    fulfillingVendorName: order.fulfillingVendor.name,
    fulfillingVendorTel: order.fulfillingVendor.telephone,
    serviceDate: order.schedule.serviceDate,
    strictTime,
    eventTime,
    venueName: order.destination.venueName,
    deliveryAddress: order.destination.address,
    recipientName: order.recipient.name,
    recipientTel: order.recipient.telephone,
    customerRequests: order.customerRequests,
  };
}

// Applies a manual edit to an existing order, preserving identity, creation
// time, source, status, settlement, and any recorded arrival/completion times.
export function applyManualEdit(
  order: DeliveryOrder,
  input: ManualOrderInput,
  now: string,
): DeliveryOrder {
  const errors = validateManualOrderInput(input);
  if (errors.length) throw new Error(errors.join(' '));
  const core = buildCore(input);
  return {
    ...order,
    ...core,
    schedule: {
      ...core.schedule,
      plannedArrivalAt: order.schedule.plannedArrivalAt,
      actualArrivalAt: order.schedule.actualArrivalAt,
      completedAt: order.schedule.completedAt,
    },
    settlement: order.settlement,
    updatedAt: now,
  };
}
