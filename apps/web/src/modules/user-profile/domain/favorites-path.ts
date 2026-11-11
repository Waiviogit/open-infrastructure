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
  /** Decoded category segments after the type (`['uncategorized']` for the Uncategorized node). */
  lineage: string[];
  /** True for `/@account/favorites/:type/uncategorized`. */
  uncategorizedOnly: boolean;
};

/** True when the lineage selects the reserved Uncategorized node. */
export function isUncategorizedLineage(lineage: readonly string[]): boolean {
  return lineage.length === 1 && lineage[0] === UNCATEGORIZED_SHOP_PATH_SEGMENT;
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
    uncategorizedOnly: isUncategorizedLineage(lineage),
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
