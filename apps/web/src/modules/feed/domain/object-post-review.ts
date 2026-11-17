import { UPDATE_TYPES } from '@opden-data-layer/core/update-types';

/** Object `pin` / `remove` state of one post on the object's Posts feed (from query-api). */
export type ObjectPostReviewState = {
  viewerPinned: boolean;
  pinUpdateId: string | null;
  removeUpdateId: string | null;
};

export type ObjectPostReviewAction = 'pin' | 'unpin' | 'remove';

export type ObjectPostReviewUpdateType = typeof UPDATE_TYPES.PIN | typeof UPDATE_TYPES.REMOVE;

/**
 * What to broadcast for a menu action. The indexer skips a second update with the same value,
 * so an existing update gets a validity vote instead of a new `update_create`.
 */
export type ObjectPostReviewOp =
  | { kind: 'create'; updateType: ObjectPostReviewUpdateType }
  | { kind: 'vote'; updateId: string; vote: 'for' | 'against' };

export function resolveObjectPostReviewOp(
  action: ObjectPostReviewAction,
  state: ObjectPostReviewState,
): ObjectPostReviewOp | null {
  if (action === 'pin') {
    return state.pinUpdateId
      ? { kind: 'vote', updateId: state.pinUpdateId, vote: 'for' }
      : { kind: 'create', updateType: UPDATE_TYPES.PIN };
  }
  if (action === 'unpin') {
    return state.pinUpdateId ? { kind: 'vote', updateId: state.pinUpdateId, vote: 'against' } : null;
  }
  return state.removeUpdateId
    ? { kind: 'vote', updateId: state.removeUpdateId, vote: 'for' }
    : { kind: 'create', updateType: UPDATE_TYPES.REMOVE };
}

/** Stored value of `pin` / `remove` updates. */
export function objectPostReviewValue(author: string, permlink: string): string {
  return `${author}/${permlink}`;
}
