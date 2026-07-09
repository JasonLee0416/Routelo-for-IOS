import { DeliveryOrder } from '../domain';

// Delivery-completion proof photos are copied out of the picker's cache into a
// stable per-order location so they survive app restarts and cache eviction.
// The path math lives here (pure, testable); the file I/O and image capture
// stay in the UI layer.

export const COMPLETION_PHOTO_DIR = 'completion-photos';

// Order ids come from generators/OCR and could in theory contain characters
// that are unsafe in a file name; keep only a conservative allowlist.
const safeName = (orderId: string): string =>
  orderId.replace(/[^a-zA-Z0-9_-]/g, '_') || 'order';

// Deterministic destination for an order's proof photo under the app's
// document directory. Same order id → same uri, so re-attaching overwrites the
// previous photo instead of leaking files.
export function completionPhotoTarget(
  documentDir: string,
  orderId: string,
): { dir: string; uri: string } {
  const base = documentDir.endsWith('/') ? documentDir : `${documentDir}/`;
  const dir = `${base}${COMPLETION_PHOTO_DIR}/`;
  return { dir, uri: `${dir}${safeName(orderId)}.jpg` };
}

export function attachCompletionPhoto(
  order: DeliveryOrder,
  uri: string,
): DeliveryOrder {
  return { ...order, completionPhotoUri: uri };
}

export function clearCompletionPhoto(order: DeliveryOrder): DeliveryOrder {
  const { completionPhotoUri, ...rest } = order;
  void completionPhotoUri;
  return rest;
}
