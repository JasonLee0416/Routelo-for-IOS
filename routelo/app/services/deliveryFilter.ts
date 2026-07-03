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
