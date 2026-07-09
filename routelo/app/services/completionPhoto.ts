import { DeliveryOrder } from '../domain';

// Delivery-completion proof photos are copied out of the picker's cache into a
// stable location under the app document dir. The path math lives here (pure,
// testable); file I/O and image capture stay in the UI layer.
//
// Two deliberate choices, both driven by real failure modes:
//  - We store a RELATIVE path on the order and resolve it against the CURRENT
//    document dir at read time. iOS document-dir container UUIDs change across
//    reinstall / backup-restore, so a persisted absolute file URI would dangle.
//  - Each attach uses a fresh token in the file name. React Native's Image
//    caches by URI string, so reusing one path would keep showing the previous
//    photo after a re-attach; a new name busts the cache (and the old file is
//    deleted by the caller).

export const COMPLETION_PHOTO_DIR = 'completion-photos';

// Order ids / tokens come from generators and could contain characters that are
// unsafe in a file name; keep only a conservative allowlist.
const safeName = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_-]/g, '_') || 'x';

const withTrailingSlash = (dir: string): string =>
  dir.endsWith('/') ? dir : `${dir}/`;

// Path stored ON the order, relative to the document dir. `token` makes it
// unique per attach (e.g. a timestamp) for cache-busting.
export function completionPhotoRelativePath(
  orderId: string,
  token: string,
): string {
  return `${COMPLETION_PHOTO_DIR}/${safeName(orderId)}-${safeName(token)}.jpg`;
}

// Directory that must exist before copying a photo in.
export function completionPhotoDir(documentDir: string): string {
  return `${withTrailingSlash(documentDir)}${COMPLETION_PHOTO_DIR}/`;
}

// Absolute file URI for a stored relative path, against the current doc dir.
export function resolveCompletionPhotoUri(
  documentDir: string,
  relativePath: string,
): string {
  return `${withTrailingSlash(documentDir)}${relativePath}`;
}

export function attachCompletionPhoto(
  order: DeliveryOrder,
  relativePath: string,
): DeliveryOrder {
  return { ...order, completionPhotoPath: relativePath };
}

export function clearCompletionPhoto(order: DeliveryOrder): DeliveryOrder {
  const { completionPhotoPath, ...rest } = order;
  void completionPhotoPath;
  return rest;
}
