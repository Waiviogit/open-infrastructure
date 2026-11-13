import { isHiveAccountName, normalizeHiveAccountInput } from '@opden-data-layer/common';

import type { HomeFeedTabKey } from './home-feed-tabs';

/** Site-wide sorts of the rail's first section. */
export type HomeFeedSort = 'trending' | 'hot' | 'new';

/** Exactly one rail item is active; every tab reads the same filter. */
export type HomeFeedFilter =
  | { kind: HomeFeedSort }
  | { kind: 'my' }
  | { kind: 'author'; account: string }
  | { kind: 'object'; objectId: string };

/** Why the applied filter differs from the one in the URL. */
export type HomeFeedFilterNoticeKind = 'sort_unavailable' | 'sign_in_required' | 'entity_unavailable';

export type ResolvedHomeFeedFilter = {
  /** Filter the feed is loaded with. */
  effective: HomeFeedFilter;
  /** Filter named by the URL (`null` = no filter param, i.e. the default). */
  requested: HomeFeedFilter | null;
  notice: HomeFeedFilterNoticeKind | null;
};

/** Sorts each tab supports (Activity has no votes or comments; Updates has no comments). */
export const HOME_FEED_TAB_SORTS: Readonly<Record<HomeFeedTabKey, readonly HomeFeedSort[]>> = {
  posts: ['trending', 'hot', 'new'],
  threads: ['trending', 'hot', 'new'],
  activity: ['new'],
  updates: ['trending', 'new'],
};

export const HOME_FEED_FILTER_PARAM = 'filter';
export const HOME_FEED_AUTHOR_PARAM = 'author';
export const HOME_FEED_OBJECT_PARAM = 'object';

const OBJECT_ID_MAX_LENGTH = 256;
const FILTER_PARAM_VALUES = new Set(['trending', 'hot', 'new', 'my']);

export type HomeFeedSearchParamsSource =
  | Record<string, string | string[] | undefined>
  | URLSearchParams;

function readParam(source: HomeFeedSearchParamsSource, key: string): string | null {
  if (source instanceof URLSearchParams) {
    return source.get(key);
  }
  const value = source[key];
  if (value == null) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Filter named by the URL: `object` wins over `author`, which wins over `filter`.
 * Invalid values are ignored; `null` means no filter param (use the default).
 */
export function parseHomeFeedFilter(source: HomeFeedSearchParamsSource): HomeFeedFilter | null {
  const objectId = readParam(source, HOME_FEED_OBJECT_PARAM)?.trim();
  if (objectId && objectId.length <= OBJECT_ID_MAX_LENGTH) {
    return { kind: 'object', objectId };
  }
  const author = normalizeHiveAccountInput(readParam(source, HOME_FEED_AUTHOR_PARAM) ?? '');
  if (author && isHiveAccountName(author)) {
    return { kind: 'author', account: author };
  }
  const kind = readParam(source, HOME_FEED_FILTER_PARAM)?.trim();
  if (kind && FILTER_PARAM_VALUES.has(kind)) {
    return { kind: kind as HomeFeedSort | 'my' };
  }
  return null;
}

/** Search string (`?…` or empty) carrying exactly one filter param. */
export function homeFeedFilterSearch(filter: HomeFeedFilter | null): string {
  if (!filter) {
    return '';
  }
  const params = new URLSearchParams();
  switch (filter.kind) {
    case 'author':
      params.set(HOME_FEED_AUTHOR_PARAM, filter.account);
      break;
    case 'object':
      params.set(HOME_FEED_OBJECT_PARAM, filter.objectId);
      break;
    default:
      params.set(HOME_FEED_FILTER_PARAM, filter.kind);
  }
  return `?${params.toString()}`;
}

/** Tab path plus the filter's search string. */
export function buildHomeFeedHref(tabHref: string, filter: HomeFeedFilter | null): string {
  return `${tabHref}${homeFeedFilterSearch(filter)}`;
}

/** Default when the URL names no filter: My feed when signed in, else the first site-wide sort. */
export function defaultHomeFeedFilter(tab: HomeFeedTabKey, signedIn: boolean): HomeFeedFilter {
  if (signedIn) {
    return { kind: 'my' };
  }
  return { kind: HOME_FEED_TAB_SORTS[tab][0] };
}

/**
 * Applied filter for a tab. A sort the tab does not support falls back to New, `my`
 * without a session falls back to the guest default, and an author / object with no
 * items on the tab (not in `presentTabs`) falls back to the tab default. The URL keeps
 * the request, so switching back to a tab that supports it restores it.
 *
 * `presentTabs`: tabs where the requested author / object has items; `undefined` when
 * unknown (treated as present).
 */
export function resolveHomeFeedFilter(
  tab: HomeFeedTabKey,
  requested: HomeFeedFilter | null,
  signedIn: boolean,
  presentTabs?: readonly HomeFeedTabKey[],
): ResolvedHomeFeedFilter {
  if (!requested) {
    return { effective: defaultHomeFeedFilter(tab, signedIn), requested, notice: null };
  }
  if (requested.kind === 'my' && !signedIn) {
    return { effective: defaultHomeFeedFilter(tab, false), requested, notice: 'sign_in_required' };
  }
  if (isHomeFeedSort(requested.kind) && !HOME_FEED_TAB_SORTS[tab].includes(requested.kind)) {
    return { effective: { kind: 'new' }, requested, notice: 'sort_unavailable' };
  }
  if (isEntityFilter(requested) && presentTabs && !presentTabs.includes(tab)) {
    return { effective: defaultHomeFeedFilter(tab, signedIn), requested, notice: 'entity_unavailable' };
  }
  return { effective: requested, requested, notice: null };
}

/** Author / object filters: their availability differs per tab. */
export function isEntityFilter(
  filter: HomeFeedFilter,
): filter is Extract<HomeFeedFilter, { kind: 'author' | 'object' }> {
  return filter.kind === 'author' || filter.kind === 'object';
}

export function isHomeFeedSort(kind: HomeFeedFilter['kind']): kind is HomeFeedSort {
  return kind === 'trending' || kind === 'hot' || kind === 'new';
}

/** Stable key of a filter: list identity and scroll reset key. */
export function homeFeedFilterKey(filter: HomeFeedFilter | null): string {
  if (!filter) {
    return 'default';
  }
  switch (filter.kind) {
    case 'author':
      return `author:${filter.account}`;
    case 'object':
      return `object:${filter.objectId}`;
    default:
      return filter.kind;
  }
}

/** True when two filters select the same rail item. */
export function isSameHomeFeedFilter(a: HomeFeedFilter, b: HomeFeedFilter): boolean {
  return homeFeedFilterKey(a) === homeFeedFilterKey(b);
}
