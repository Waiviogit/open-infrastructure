import { UPDATE_TYPES } from '@opden-data-layer/core';
import type {
  ResolvedObjectView,
  ResolvedUpdate,
  ValidityTier,
} from '@opden-data-layer/objects-domain';
import type { ObjectUpdate, ValidityVote } from '@opden-data-layer/odl-db-types';

import {
  collectViewerUpdateVotes,
  EMPTY_VIEWER_UPDATE_VOTES,
  mapPostRefUpdateIds,
  selectObjectFeaturedPostRef,
  selectObjectFeedPins,
} from './object-feed-pins';

function update(
  updateType: string,
  id: string,
  ref: string,
  opts: { creator?: string; tier?: ValidityTier; weight?: number | null; seq?: number } = {},
): ResolvedUpdate {
  return {
    update_id: id,
    update_type: updateType,
    creator: opts.creator ?? 'someone',
    locale: null,
    created_at_unix: opts.seq ?? 1,
    event_seq: BigInt(opts.seq ?? 1),
    value_text: ref,
    value_geo: null,
    value_json: null,
    validity_status: 'VALID',
    validity_tier: opts.tier ?? 'baseline',
    decisive_vote_event_seq: null,
    approve_percent: 100,
    field_weight: opts.weight ?? null,
    rank_score: null,
    rank_context: null,
    rank_decisive_event_seq: null,
  };
}

function view(pins: ResolvedUpdate[], removes: ResolvedUpdate[] = []): ResolvedObjectView {
  return {
    object_id: 'obj-1',
    object_type: 'drink',
    creator: 'alice',
    weight: 0,
    meta_group_id: null,
    status: 'active',
    canonical: null,
    fields: {
      [UPDATE_TYPES.PIN]: { update_type: UPDATE_TYPES.PIN, cardinality: 'multi', values: pins },
      [UPDATE_TYPES.REMOVE]: {
        update_type: UPDATE_TYPES.REMOVE,
        cardinality: 'multi',
        values: removes,
      },
    },
  };
}

const pin = (id: string, ref: string, opts?: Parameters<typeof update>[3]) =>
  update(UPDATE_TYPES.PIN, id, ref, opts);

describe('selectObjectFeedPins', () => {
  it('caps pins and orders them by tier, then weight, then recency', () => {
    const result = selectObjectFeedPins({
      view: view([
        pin('p1', 'ann/old', { seq: 1 }),
        pin('p2', 'ann/new', { seq: 5 }),
        pin('p3', 'ann/admin', { tier: 'admin', seq: 2 }),
        pin('p4', 'ann/liked', { tier: 'community', weight: 50, seq: 3 }),
      ]),
      viewerVotes: EMPTY_VIEWER_UPDATE_VOTES,
      maxPinned: 3,
    });

    expect(result.pinnedRefs).toEqual(['ann/admin', 'ann/liked', 'ann/new']);
    expect(result.viewerPinnedRefs).toEqual([]);
  });

  it('lets remove beat pin', () => {
    const result = selectObjectFeedPins({
      view: view([pin('p1', 'ann/post')], [update(UPDATE_TYPES.REMOVE, 'r1', 'ann/post')]),
      viewerVotes: EMPTY_VIEWER_UPDATE_VOTES,
      maxPinned: 3,
    });

    expect(result.pinnedRefs).toEqual([]);
    expect(result.removeRefs).toEqual(['ann/post']);
  });

  it("puts the viewer's pins first, beyond the cap", () => {
    const result = selectObjectFeedPins({
      view: view([
        pin('p1', 'ann/admin', { tier: 'admin' }),
        pin('p2', 'ann/mine', { creator: 'viewer' }),
        pin('p3', 'ann/voted'),
      ]),
      viewerAccount: 'viewer',
      viewerVotes: { supported: new Set(['p3']), rejected: new Set() },
      maxPinned: 1,
    });

    expect(result.pinnedRefs).toEqual(['ann/mine', 'ann/voted', 'ann/admin']);
    expect(result.viewerPinnedRefs).toEqual(['ann/mine', 'ann/voted']);
  });

  it('does not count a pin the viewer voted against as theirs', () => {
    const result = selectObjectFeedPins({
      view: view([pin('p1', 'ann/mine', { creator: 'viewer' })]),
      viewerAccount: 'viewer',
      viewerVotes: { supported: new Set(), rejected: new Set(['p1']) },
      maxPinned: 0,
    });

    expect(result.pinnedRefs).toEqual([]);
  });

  it('skips rejected and malformed pins and dedupes refs', () => {
    const rejected = { ...pin('p1', 'ann/rejected'), validity_status: 'REJECTED' as const };
    const result = selectObjectFeedPins({
      view: view([rejected, pin('p2', 'not-a-ref'), pin('p3', 'ann/post'), pin('p4', 'ann/post')]),
      viewerVotes: EMPTY_VIEWER_UPDATE_VOTES,
      maxPinned: 3,
    });

    expect(result.pinnedRefs).toEqual(['ann/post']);
  });
});

describe('collectViewerUpdateVotes', () => {
  it("splits the viewer's votes into supported and rejected", () => {
    const votes = [
      { update_id: 'u1', voter: 'viewer', vote: 'for' },
      { update_id: 'u2', voter: 'viewer', vote: 'against' },
      { update_id: 'u3', voter: 'other', vote: 'for' },
    ] as ValidityVote[];

    const result = collectViewerUpdateVotes(votes, 'viewer');

    expect([...result.supported]).toEqual(['u1']);
    expect([...result.rejected]).toEqual(['u2']);
    expect(collectViewerUpdateVotes(votes, undefined)).toBe(EMPTY_VIEWER_UPDATE_VOTES);
  });
});

describe('mapPostRefUpdateIds', () => {
  it('maps each ref to its earliest update of the given type', () => {
    const rows = [
      { update_id: 'p2', update_type: 'pin', value_text: 'ann/post', event_seq: BigInt(5) },
      { update_id: 'p1', update_type: 'pin', value_text: 'ann/post', event_seq: BigInt(1) },
      { update_id: 'r1', update_type: 'remove', value_text: 'ann/other', event_seq: BigInt(2) },
      { update_id: 'p3', update_type: 'pin', value_text: 'broken', event_seq: BigInt(3) },
    ] as ObjectUpdate[];

    expect([...mapPostRefUpdateIds(rows, UPDATE_TYPES.PIN)]).toEqual([['ann/post', 'p1']]);
  });
});

describe('selectObjectFeaturedPostRef', () => {
  it('returns the top pin, not the viewer-specific one', () => {
    const v = view([
      pin('p1', 'ann/admin', { tier: 'admin' }),
      pin('p2', 'ann/newer', { seq: 9 }),
    ]);

    expect(selectObjectFeaturedPostRef(v)).toEqual({ author: 'ann', permlink: 'admin' });
  });

  it('skips a removed pin and returns null without pins', () => {
    const removed = view([pin('p1', 'ann/post')], [update(UPDATE_TYPES.REMOVE, 'r1', 'ann/post')]);

    expect(selectObjectFeaturedPostRef(removed)).toBeNull();
    expect(selectObjectFeaturedPostRef(view([]))).toBeNull();
  });
});
