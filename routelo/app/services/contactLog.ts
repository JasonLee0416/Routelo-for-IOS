import { ContactChannel, ContactLog } from '../models';

const LABEL_TO_CHANNEL: Record<string, ContactChannel> = {
  수령인: 'recipient',
  발주처: 'orderingVendor',
  화원: 'fulfillingVendor',
};

// Map the button label captured at call time to a stable channel enum, so the
// history stays meaningful even if labels are reworded later.
export function channelFromLabel(label: string): ContactChannel {
  return LABEL_TO_CHANNEL[label] ?? 'other';
}

// Pure builder — the caller supplies id/timestamp so this stays testable.
export function buildContactLog(input: {
  id: string;
  deliveryId: string;
  label: string;
  phone: string;
  at: string;
}): ContactLog {
  return {
    id: input.id,
    deliveryId: input.deliveryId,
    channel: channelFromLabel(input.label),
    label: input.label,
    phone: input.phone,
    at: input.at,
  };
}

// Most-recent-first contacts for one delivery, capped at `limit`.
export function recentContactsForDelivery(
  logs: ContactLog[],
  deliveryId: string,
  limit = 5,
): ContactLog[] {
  return logs
    .filter((log) => log.deliveryId === deliveryId)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, limit);
}
