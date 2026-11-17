import { formatPostRef, parsePostRef, UPDATE_TYPES, type PostRef } from '@opden-data-layer/core';
import {
  compareResolvedSingleCardinality,
  type ResolvedObjectView,
  type ResolvedUpdate,
} from '@opden-data-layer/objects-domain';
import type { ObjectUpdate, ValidityVote } from '@opden-data-layer/odl-db-types';

/** Viewer's raw validity votes on the object's updates, by update id. */
export interface ViewerUpdateVotes {
  supported: ReadonlySet<string>;
  rejected: ReadonlySet<string>;
}

export interface ObjectFeedPinSelection {
  /** Pinned post refs in display order: viewer's pins first, then the top `maxPinned` of the rest. */
  pinnedRefs: string[];
  /** Subset of {@link pinnedRefs} pinned by the viewer (creator or `for` vote). */
  viewerPinnedRefs: string[];
  /** Post refs hidden by a valid `remove` update. */
  removeRefs: string[];
}

export const EMPTY_VIEWER_UPDATE_VOTES: ViewerUpdateVotes = {
  supported: new Set(),
  rejected: new Set(),
};

function validRefUpdates(
  view: ResolvedObjectView,
  updateType: string,
): { ref: string; update: ResolvedUpdate }[] {
  const out: { ref: string; update: ResolvedUpdate }[] = [];
  for (const update of view.fields[updateType]?.values ?? []) {
    if (update.validity_status !== 'VALID' || !update.value_text) {
      continue;
    }
    const parsed = parsePostRef(update.value_text);
    if (parsed) {
      out.push({ ref: formatPostRef(parsed), update });
    }
  }
  return out;
}

function isViewerPin(
  update: ResolvedUpdate,
  viewerAccount: string,
  viewerVotes: ViewerUpdateVotes,
): boolean {
  if (viewerAccount === '' || viewerVotes.rejected.has(update.update_id)) {
    return false;
  }
  return viewerVotes.supported.has(update.update_id) || update.creator === viewerAccount;
}

/**
 * Picks the pinned posts for an object's Posts feed (legacy `getPinFilter`):
 * `remove` beats `pin`; pins rank by governance tier, then community weight, then recency.
 */
export function selectObjectFeedPins(params: {
  view: ResolvedObjectView;
  viewerAccount?: string;
  viewerVotes: ViewerUpdateVotes;
  maxPinned: number;
}): ObjectFeedPinSelection {
  const { view, viewerVotes, maxPinned } = params;
  const viewer = params.viewerAccount?.trim() ?? '';

  const removeRefs = [...new Set(validRefUpdates(view, UPDATE_TYPES.REMOVE).map((r) => r.ref))];
  const removed = new Set(removeRefs);

  const seen = new Set<string>();
  const candidates = validRefUpdates(view, UPDATE_TYPES.PIN)
    .filter((c) => !removed.has(c.ref))
    .sort((a, b) => compareResolvedSingleCardinality(a.update, b.update))
    .filter((c) => {
      if (seen.has(c.ref)) {
        return false;
      }
      seen.add(c.ref);
      return true;
    });

  const viewerPinnedRefs: string[] = [];
  const otherRefs: string[] = [];
  for (const c of candidates) {
    if (isViewerPin(c.update, viewer, viewerVotes)) {
      viewerPinnedRefs.push(c.ref);
    } else {
      otherRefs.push(c.ref);
    }
  }

  return {
    pinnedRefs: [...viewerPinnedRefs, ...otherRefs.slice(0, maxPinned)],
    viewerPinnedRefs,
    removeRefs,
  };
}

export function collectViewerUpdateVotes(
  votes: readonly ValidityVote[],
  viewerAccount?: string,
): ViewerUpdateVotes {
  const viewer = viewerAccount?.trim() ?? '';
  if (viewer === '') {
    return EMPTY_VIEWER_UPDATE_VOTES;
  }
  const supported = new Set<string>();
  const rejected = new Set<string>();
  for (const v of votes) {
    if (v.voter !== viewer) {
      continue;
    }
    (v.vote === 'for' ? supported : rejected).add(v.update_id);
  }
  return { supported, rejected };
}

/**
 * `author/permlink` → update id for every stored update of `updateType`, any validity.
 * The indexer skips duplicate values, so the client votes on this id instead of re-creating it.
 * When legacy data holds several rows for one ref, the earliest one wins.
 */
export function mapPostRefUpdateIds(
  updates: readonly ObjectUpdate[],
  updateType: string,
): Map<string, string> {
  const rows = updates
    .filter((u) => u.update_type === updateType && u.value_text)
    .sort((a, b) => (a.event_seq < b.event_seq ? -1 : a.event_seq > b.event_seq ? 1 : 0));

  const out = new Map<string, string>();
  for (const row of rows) {
    const parsed = parsePostRef(row.value_text ?? '');
    if (!parsed) {
      continue;
    }
    const ref = formatPostRef(parsed);
    if (!out.has(ref)) {
      out.set(ref, row.update_id);
    }
  }
  return out;
}

/** The featured post is the first pinned post shown to every viewer. */
const FEATURED_POST_PIN_COUNT = 1;

/**
 * Featured post of an object (recipe Details, …): the top-ranked valid pin, the same for every
 * viewer — the viewer's own pins do not replace it. `remove` beats `pin` as in the Posts feed.
 */
export function selectObjectFeaturedPostRef(view: ResolvedObjectView): PostRef | null {
  const { pinnedRefs } = selectObjectFeedPins({
    view,
    viewerVotes: EMPTY_VIEWER_UPDATE_VOTES,
    maxPinned: FEATURED_POST_PIN_COUNT,
  });
  return pinnedRefs[0] ? parsePostRef(pinnedRefs[0]) : null;
}
