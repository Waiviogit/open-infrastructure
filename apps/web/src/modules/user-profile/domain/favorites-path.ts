import {
  decodeCategoryPathSegment,
  UNCATEGORIZED_SHOP_PATH_SEGMENT,
} from './category-nav-path';
import { getSegmentsAfterAccount } from '../presentation/components/profile-path';

/** First profile segment of the Favorites tab (`/@account/favorites/...`). */
export const FAVORITES_TAB_SEGMENT = 'favorites';

/**
 * Favorites tab location parsed from a profile pathname.
 * `objectType` is null on bare `/@account/favorites` (the page shows the first type).
 */
export type FavoritesPath = {
  objectType: string | null;
  /** Decoded category segments after the type (`['uncategorized']` on a legacy root Other link). */
  lineage: string[];
};

/** Query param of the Other category of the lineage (`?other=1`). */
export const FAVORITES_OTHER_PARAM = 'other';

/** True for the legacy `/@account/favorites/:type/uncategorized` link (now the root Other). */
export function isUncategorizedLineage(lineage: readonly string[]): boolean {
  return lineage.length === 1 && lineage[0] === UNCATEGORIZED_SHOP_PATH_SEGMENT;
}

/** What a Favorites URL shows: a category lineage, or the Other category of that lineage. */
export type FavoritesCategoryView = {
  /** Category names from the type root (the legacy Uncategorized segment removed). */
  lineage: string[];
  /**
   * The virtual Other category of `lineage`: its objects in none of the child categories the tree
   * shows (at the root also the uncategorized ones).
   */
  other: boolean;
};

/** Reads `?other=1` from page `searchParams` or `URLSearchParams`. */
export function readFavoritesOtherParam(
  source: URLSearchParams | Record<string, string | string[] | undefined>,
): boolean {
  const raw =
    source instanceof URLSearchParams ? source.get(FAVORITES_OTHER_PARAM) : source[FAVORITES_OTHER_PARAM];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === '1';
}

/** Category view of a Favorites URL; the legacy `/uncategorized` segment is the root Other. */
export function resolveFavoritesCategoryView(
  lineageSegments: readonly string[],
  otherParam: boolean,
): FavoritesCategoryView {
  if (isUncategorizedLineage(lineageSegments)) {
    return { lineage: [], other: true };
  }
  return { lineage: [...lineageSegments], other: otherParam };
}

/**
 * Parses `/@account/favorites[/:type[/...lineage]]` (or the internal `/user-profile/account/...`).
 * Returns null for any other profile tab.
 */
export function parseFavoritesPath(pathname: string): FavoritesPath | null {
  const segments = getSegmentsAfterAccount(pathname);
  if (segments[0] !== FAVORITES_TAB_SEGMENT) {
    return null;
  }
  const rawType = segments[1];
  const objectType = rawType ? decodeCategoryPathSegment(rawType).trim() : '';
  const lineage = segments.slice(2).map(decodeCategoryPathSegment);
  return {
    objectType: objectType.length > 0 ? objectType : null,
    lineage,
  };
}

/** Public Favorites URL: `/@account/favorites[/:type[/...lineage]]` with encoded segments. */
export function buildFavoritesPath(
  accountName: string,
  objectType?: string | null,
  lineage: readonly string[] = [],
): string {
  const base = `/@${accountName}/${FAVORITES_TAB_SEGMENT}`;
  const type = objectType?.trim();
  if (!type) {
    return base;
  }
  const segments = [type, ...lineage].map((segment) => encodeURIComponent(segment));
  return `${base}/${segments.join('/')}`;
}
