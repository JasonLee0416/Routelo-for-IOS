import { DeliveryOrder } from '../../domain';
import {
  attachReceiptPhoto,
  receiptPhotoDir,
  receiptPhotoRelativePath,
  resolveReceiptPhotoUri,
} from '../receiptPhoto';

describe('receiptPhoto path service', () => {
  test('relative path is sanitized and unique by token', () => {
    expect(receiptPhotoRelativePath('order 1/x', '1700')).toBe(
      'receipt-photos/order_1_x-1700.jpg',
    );
  });

  test('dir and resolve honor the current document dir (trailing slash safe)', () => {
    expect(receiptPhotoDir('file:///docs')).toBe('file:///docs/receipt-photos/');
    expect(receiptPhotoDir('file:///docs/')).toBe('file:///docs/receipt-photos/');
    expect(
      resolveReceiptPhotoUri('file:///docs', 'receipt-photos/a-1.jpg'),
    ).toBe('file:///docs/receipt-photos/a-1.jpg');
  });

  test('attachReceiptPhoto stores the relative path on the order', () => {
    const order = { id: 'a' } as DeliveryOrder;
    expect(attachReceiptPhoto(order, 'receipt-photos/a-1.jpg').receiptPhotoPath).toBe(
      'receipt-photos/a-1.jpg',
    );
  });
});
