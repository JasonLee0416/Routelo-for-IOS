import { DeliveryOrder } from '../../domain';
import {
  attachCompletionPhoto,
  clearCompletionPhoto,
  completionPhotoDir,
  completionPhotoRelativePath,
  COMPLETION_PHOTO_DIR,
  resolveCompletionPhotoUri,
} from '../completionPhoto';

const order = (over: Partial<DeliveryOrder> = {}): DeliveryOrder =>
  ({ id: 'd1', status: 'completed', ...over }) as DeliveryOrder;

describe('completionPhotoRelativePath', () => {
  test('is relative (no doc dir) and includes the token for cache-busting', () => {
    expect(completionPhotoRelativePath('d1', '1720000000000')).toBe(
      `${COMPLETION_PHOTO_DIR}/d1-1720000000000.jpg`,
    );
  });

  test('different tokens yield different paths (re-attach busts Image cache)', () => {
    expect(completionPhotoRelativePath('d1', 'a')).not.toBe(
      completionPhotoRelativePath('d1', 'b'),
    );
  });

  test('sanitizes unsafe characters in id and token', () => {
    expect(completionPhotoRelativePath('a/b:1', 't x')).toBe(
      `${COMPLETION_PHOTO_DIR}/a_b_1-t_x.jpg`,
    );
  });
});

describe('resolveCompletionPhotoUri / completionPhotoDir', () => {
  test('resolves a relative path against the document dir', () => {
    expect(
      resolveCompletionPhotoUri('file:///docs/', `${COMPLETION_PHOTO_DIR}/d1-1.jpg`),
    ).toBe(`file:///docs/${COMPLETION_PHOTO_DIR}/d1-1.jpg`);
  });

  test('normalizes a document dir with no trailing slash', () => {
    expect(resolveCompletionPhotoUri('file:///docs', 'x.jpg')).toBe(
      'file:///docs/x.jpg',
    );
    expect(completionPhotoDir('file:///docs')).toBe(
      `file:///docs/${COMPLETION_PHOTO_DIR}/`,
    );
  });
});

describe('attach / clear completion photo', () => {
  test('attach sets the relative path without mutating the input', () => {
    const original = order();
    const next = attachCompletionPhoto(original, 'completion-photos/d1-1.jpg');
    expect(next.completionPhotoPath).toBe('completion-photos/d1-1.jpg');
    expect(original.completionPhotoPath).toBeUndefined();
  });

  test('clear removes the path key entirely', () => {
    const withPhoto = order({ completionPhotoPath: 'completion-photos/d1-1.jpg' });
    const cleared = clearCompletionPhoto(withPhoto);
    expect('completionPhotoPath' in cleared).toBe(false);
  });
});
