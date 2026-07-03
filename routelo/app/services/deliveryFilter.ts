import { Delivery } from '../models';

export type DeliveryStatusFilter = 'all' | 'pending' | 'completed';

export type DeliverySearchCriteria = {
  query?: string;
  status?: DeliveryStatusFilter;
};

// Filters the delivery list by status and a free-text query. The query is a
// case-insensitive substring match across the human-visible fields (product,
// address, vendors, recipient phone, requests, and the date/event times), so a
// user can search by shop, place, phone tail, or a date fragment like "07-10".
export type DeliverySortMode = 'urgency' | 'recent';

// Orders the (already filtered) list. 'recent' keeps the caller's order
// (newest-first). 'urgency' puts pending before completed, then the earliest
// deadline datetime first; deliveries without a datetime sort last. String
// comparison is used directly (no locale) so the order is deterministic.
export function sortDeliveries(
  deliveries: Delivery[],
  mode: DeliverySortMode,
): Delivery[] {
  if (mode === 'recent') return [...deliveries];
  const key = (delivery: Delivery) =>
    delivery.deliveryDt?.trim() || '9999-99-99 99:99';
  return [...deliveries].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    const ka = key(a);
    const kb = key(b);
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    return a.id.localeCompare(b.id);
  });
}

export function filterDeliveries(
  deliveries: Delivery[],
  criteria: DeliverySearchCriteria,
): Delivery[] {
  const status = criteria.status ?? 'all';
  const query = (criteria.query ?? '').trim().toLowerCase();
  return deliveries.filter((delivery) => {
    if (status !== 'all' && delivery.status !== status) return false;
    if (!query) return true;
    const haystack = [
      delivery.productName,
      delivery.deliveryAddress,
      delivery.orderVendor,
      delivery.deliveryVendor,
      delivery.recipientTel,
      delivery.customerRequests,
      delivery.deliveryDt,
      delivery.eventTime,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}
