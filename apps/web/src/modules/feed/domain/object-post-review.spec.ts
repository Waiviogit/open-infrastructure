import { resolveObjectPostReviewOp, type ObjectPostReviewState } from './object-post-review';

const empty: ObjectPostReviewState = { viewerPinned: false, pinUpdateId: null, removeUpdateId: null };

describe('resolveObjectPostReviewOp', () => {
  it('creates a pin update when the post has none', () => {
    expect(resolveObjectPostReviewOp('pin', empty)).toEqual({ kind: 'create', updateType: 'pin' });
  });

  it('votes for an existing pin update instead of creating a duplicate', () => {
    expect(resolveObjectPostReviewOp('pin', { ...empty, pinUpdateId: 'u1' })).toEqual({
      kind: 'vote',
      updateId: 'u1',
      vote: 'for',
    });
  });

  it('unpins by voting against the pin update', () => {
    expect(
      resolveObjectPostReviewOp('unpin', { ...empty, viewerPinned: true, pinUpdateId: 'u1' }),
    ).toEqual({ kind: 'vote', updateId: 'u1', vote: 'against' });
    expect(resolveObjectPostReviewOp('unpin', empty)).toBeNull();
  });

  it('creates a remove update or votes for the existing one', () => {
    expect(resolveObjectPostReviewOp('remove', empty)).toEqual({
      kind: 'create',
      updateType: 'remove',
    });
    expect(resolveObjectPostReviewOp('remove', { ...empty, removeUpdateId: 'r1' })).toEqual({
      kind: 'vote',
      updateId: 'r1',
      vote: 'for',
    });
  });
});
