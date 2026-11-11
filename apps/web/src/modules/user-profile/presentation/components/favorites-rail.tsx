import { getFavoritesRailNavQuery } from '../../application/queries/get-favorites-rail-nav.query';
import { getFavoritesTypesQuery } from '../../application/queries/get-favorites.query';
import { favoritesTypeHasCategories } from '../../domain/types/favorites';
import { FavoritesRailPanel } from './favorites-rail-panel';

export type FavoritesRailProps = {
  accountName: string;
  /** Type from the URL; omitted on bare `/@name/favorites` (first type is shown). */
  routeObjectType?: string;
  /** Decoded category segments after the type. */
  lineageSegments?: readonly string[];
};

/** Left rail of the Favorites tab: type accordion with the category nav of the active type. */
export async function FavoritesRail({
  accountName,
  routeObjectType,
  lineageSegments = [],
}: FavoritesRailProps) {
  const { items } = await getFavoritesTypesQuery(accountName);
  const routeType = routeObjectType?.trim();
  const objectType = routeType && routeType.length > 0 ? routeType : (items[0]?.objectType ?? null);
  const withCategories = objectType !== null && favoritesTypeHasCategories(items, objectType);
  const nav = withCategories
    ? await getFavoritesRailNavQuery(accountName, objectType, lineageSegments)
    : null;

  return (
    <FavoritesRailPanel
      accountName={accountName}
      items={items}
      serverObjectType={objectType}
      lineageSegments={[...lineageSegments]}
      navData={nav?.data ?? null}
      navLineage={nav?.navLineage ?? []}
    />
  );
}
