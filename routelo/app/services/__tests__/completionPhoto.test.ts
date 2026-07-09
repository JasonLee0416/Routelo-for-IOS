import { DeliveryOrder } from '../../domain';
import {
  attachCompletionPhoto,
  clearCompletionPhoto,
  completionPhotoTarget,
  COMPLETION_PHOTO_DIR,
} from '../completionPhoto';

const order = (over: Partial<DeliveryOrder> = {}): DeliveryOrder =>
  ({ id: 'd1', status: 'completed', ...over }) as DeliveryOrder;

describe('completionPhotoTarget', () => {
  test('builds a stable per-order jpg path under the document dir', () => {
    const { dir, uri } = completionPhotoTarget('file:///docs/', 'd1');
    expect(dir).toBe(`file:///docs/${COMPLETION_PHOTO_DIR}/`);
    expect(uri).toBe(`file:///docs/${COMPLETION_PHOTO_DIR}/d1.jpg`);
  });

  test('normalizes a document dir with no trailing slash', () => {
    const { uri } = completionPhotoTarget('file:///docs', 'd1');
    expect(uri).toBe(`file:///docs/${COMPLETION_PHOTO_DIR}/d1.jpg`);
  });

  test('is deterministic (same id → same uri) so re-attach overwrites', () => {
    const a = completionPhotoTarget('file:///docs/', 'abc');
    const b = completionPhotoTarget('file:///docs/', 'abc');
    expect(a.uri).toBe(b.uri);
  });

  test('sanitizes unsafe characters in the order id', () => {
    const { uri } = completionPhotoTarget('file:///docs/', 'a/b:c 1');
    expect(uri).toBe(`file:///docs/${COMPLETION_PHOTO_DIR}/a_b_c_1.jpg`);
  });
});

describe('attach / clear completion photo', () => {
  test('attach sets the uri without mutating the input', () => {
    const original = order();
    const next = attachCompletionPhoto(original, 'file:///p.jpg');
    expect(next.completionPhotoUri).toBe('file:///p.jpg');
    expect(original.completionPhotoUri).toBeUndefined();
  });

  test('clear removes the uri key entirely', () => {
    const withPhoto = order({ completionPhotoUri: 'file:///p.jpg' });
    const cleared = clearCompletionPhoto(withPhoto);
    expect('completionPhotoUri' in cleared).toBe(false);
  });
});
