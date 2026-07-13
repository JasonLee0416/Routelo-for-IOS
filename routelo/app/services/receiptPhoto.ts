import { DeliveryOrder } from '../domain';

// Scanned receipt (인수증) images are copied out of the picker cache into a
// stable location under the app document dir, mirroring completionPhoto.ts.
// A relative path is stored ON the order and resolved against the CURRENT
// document dir at read time, so it survives the iOS container UUID changing
// across reinstall / backup-restore. Pure path math here; file I/O in the UI.

export const RECEIPT_PHOTO_DIR = 'receipt-photos';

const safeName = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_-]/g, '_') || 'x';

const withTrailingSlash = (dir: string): string =>
  dir.endsWith('/') ? dir : `${dir}/`;

export function receiptPhotoRelativePath(
  orderId: string,
  token: string,
): string {
  return `${RECEIPT_PHOTO_DIR}/${safeName(orderId)}-${safeName(token)}.jpg`;
}

export function receiptPhotoDir(documentDir: string): string {
  return `${withTrailingSlash(documentDir)}${RECEIPT_PHOTO_DIR}/`;
}

export function resolveReceiptPhotoUri(
  documentDir: string,
  relativePath: string,
): string {
  return `${withTrailingSlash(documentDir)}${relativePath}`;
}

export function attachReceiptPhoto(
  order: DeliveryOrder,
  relativePath: string,
): DeliveryOrder {
  return { ...order, receiptPhotoPath: relativePath };
}
